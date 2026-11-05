import { useEffect, useRef, useState } from 'react'

// Lógica de recorte/zoom/HEIC/guardado compartida entre la ficha
// (FotoPacienteSlide, SlideOver) y el portal (FotoPerfilSheet, bottom sheet) —
// cada uno la consume con su propio markup/clases/tamaños, pero el cálculo
// sensible (bake(), conversión HEIC, límites, mapeo de errores del server) es
// uno solo para no duplicar lógica que puede introducir una regresión en un
// lado sin que se note en el otro.

export type ErrorFoto = 'fmt' | 'size' | 'net'

export const ERR: Record<ErrorFoto, string> = {
  fmt: 'Formato no soportado. Usá una foto JPG, PNG o HEIC.',
  size: 'La foto pesa más de 10 MB. Elegí una más liviana.',
  net: 'Sin conexión. La foto no se guardó; probá de nuevo cuando vuelva la señal.',
}

const OK_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']
const MAX_ENTRADA_BYTES = 10 * 1024 * 1024
const SALIDA_PX = 512

function esHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

function mapearErrorServidor(codigo: unknown): ErrorFoto {
  if (codigo === 'tipo_invalido') return 'fmt'
  if (codigo === 'archivo_muy_grande') return 'size'
  return 'net'
}

interface Options {
  endpoint: string
  avatarPath: string | null
  abierto: boolean
  onSaved: () => void
  onRemoved: () => void
}

export function useRecorteFoto({ endpoint, avatarPath, abierto, onSaved, onRemoved }: Options) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [cargandoExistente, setCargandoExistente] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<ErrorFoto | null>(null)

  const cropRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const arrastreRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  function setFuente(url: string | null) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = url
    setImgSrc(url)
  }

  useEffect(() => {
    if (!abierto) return
    setDirty(false)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setError(null)
    setFuente(null)

    if (!avatarPath) return
    let cancelado = false
    setCargandoExistente(true)
    fetch(endpoint, { cache: 'no-store' })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelado || !blob) return
        setFuente(URL.createObjectURL(blob))
      })
      .finally(() => { if (!cancelado) setCargandoExistente(false) })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, avatarPath, endpoint])

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }, [])

  const bloqueado = busy || cargandoExistente
  const canSave = dirty && !!imgSrc && !busy

  async function tomarArchivo(file: File) {
    setError(null)
    if (file.size > MAX_ENTRADA_BYTES) { setError('size'); return }

    let archivo: File | Blob = file
    if (esHeic(file)) {
      try {
        const heic2any = (await import('heic2any')).default
        const convertido = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
        archivo = Array.isArray(convertido) ? convertido[0] : convertido
      } catch {
        setError('fmt')
        return
      }
    } else if (!OK_TYPES.includes(file.type)) {
      setError('fmt')
      return
    }

    setFuente(URL.createObjectURL(archivo))
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setDirty(true)
  }

  function abrirSelector(modo: 'gal' | 'cam', captureMode: 'environment' | 'user') {
    const input = fileInputRef.current
    if (!input) return
    if (modo === 'cam') input.setAttribute('capture', captureMode)
    else input.removeAttribute('capture')
    input.value = ''
    input.click()
  }

  function clamp(x: number, y: number, z: number) {
    const w = cropRef.current?.clientWidth ?? 320
    const m = (w * (z - 1)) / 2
    return { x: Math.max(-m, Math.min(m, x)), y: Math.max(-m, Math.min(m, y)) }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!imgSrc || bloqueado) return
    arrastreRef.current = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y }
    cropRef.current?.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const inicio = arrastreRef.current
    if (!inicio) return
    const nuevo = clamp(inicio.x + e.clientX - inicio.px, inicio.y + e.clientY - inicio.py, zoom)
    setPan(nuevo)
    setDirty(true)
  }
  function onPointerUp() { arrastreRef.current = null }

  function onZoomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const z = parseFloat(e.target.value)
    setZoom(z)
    setPan((p) => clamp(p.x, p.y, z))
    setDirty(true)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) tomarArchivo(f)
  }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); setDragOver(true) }
  function onDragLeave() { setDragOver(false) }

  function bake(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!imgSrc) { reject(new Error('sin imagen')); return }
      const im = new Image()
      im.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = SALIDA_PX
          canvas.height = SALIDA_PX
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('sin contexto 2d')); return }
          const s = Math.min(im.naturalWidth, im.naturalHeight)
          const sx = (im.naturalWidth - s) / 2
          const sy = (im.naturalHeight - s) / 2
          const w = cropRef.current?.clientWidth ?? 320
          const k = SALIDA_PX / w
          const d = SALIDA_PX * zoom
          ctx.drawImage(im, sx, sy, s, s, (SALIDA_PX - d) / 2 + pan.x * k, (SALIDA_PX - d) / 2 + pan.y * k, d, d)
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob falló'))), 'image/jpeg', 0.9)
        } catch (e) {
          reject(e instanceof Error ? e : new Error('bake falló'))
        }
      }
      im.onerror = () => reject(new Error('No pudimos leer esta foto.'))
      im.src = imgSrc
    })
  }

  async function guardar() {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      const blob = await bake()
      const form = new FormData()
      form.append('foto', blob, 'foto.jpg')
      const res = await fetch(endpoint, { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setBusy(false)
        setError(mapearErrorServidor(data?.error))
        return
      }
      setBusy(false)
      onSaved()
    } catch {
      setBusy(false)
      setError('net')
    }
  }

  async function quitar() {
    setBusy(true)
    setRemoving(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (!res.ok) {
        setBusy(false)
        setRemoving(false)
        setError('net')
        return
      }
      setBusy(false)
      setRemoving(false)
      onRemoved()
    } catch {
      setBusy(false)
      setRemoving(false)
      setError('net')
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) tomarArchivo(f)
  }

  return {
    imgSrc, cargandoExistente, dirty, zoom, dragOver, busy, removing, error, bloqueado, canSave,
    cropRef, fileInputRef,
    pan,
    onPointerDown, onPointerMove, onPointerUp,
    onZoomChange,
    onDrop, onDragOver, onDragLeave,
    abrirSelector, onFileChange,
    guardar, quitar,
  }
}
