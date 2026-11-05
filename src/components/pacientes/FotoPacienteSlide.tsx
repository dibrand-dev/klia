'use client'

import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import SlideOver from '@/components/ui/SlideOver'

type ErrorFoto = 'fmt' | 'size' | 'net'

const ERR: Record<ErrorFoto, string> = {
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

interface Props {
  open: boolean
  onClose: () => void
  pacienteId: string
  pacienteNombreCompleto: string
  pacientePrimerNombre: string
  iniciales: string
  avatarPath: string | null
  avatarUpdatedAt: string | null
  avatarOrigen: 'profesional' | 'paciente' | null
  onSaved: () => void
  onRemoved: () => void
}

export default function FotoPacienteSlide({
  open, onClose, pacienteId, pacienteNombreCompleto, pacientePrimerNombre, iniciales, avatarPath, avatarUpdatedAt, avatarOrigen, onSaved, onRemoved,
}: Props) {
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
    if (!open) return
    setDirty(false)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setError(null)
    setFuente(null)

    if (!avatarPath) return
    let cancelado = false
    setCargandoExistente(true)
    fetch(`/api/pacientes/${pacienteId}/foto`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelado || !blob) return
        setFuente(URL.createObjectURL(blob))
      })
      .finally(() => { if (!cancelado) setCargandoExistente(false) })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, avatarPath, pacienteId])

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

  function abrirSelector(modo: 'gal' | 'cam') {
    const input = fileInputRef.current
    if (!input) return
    if (modo === 'cam') input.setAttribute('capture', 'environment')
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

  function mapearErrorServidor(codigo: unknown): ErrorFoto {
    if (codigo === 'tipo_invalido') return 'fmt'
    if (codigo === 'archivo_muy_grande') return 'size'
    return 'net'
  }

  async function guardar() {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      const blob = await bake()
      const form = new FormData()
      form.append('foto', blob, 'foto.jpg')
      const res = await fetch(`/api/pacientes/${pacienteId}/foto`, { method: 'POST', body: form })
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
      const res = await fetch(`/api/pacientes/${pacienteId}/foto`, { method: 'DELETE' })
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

  function handleClose() {
    if (busy) return
    onClose()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) tomarArchivo(f)
  }

  const fecha = avatarUpdatedAt ? format(parseISO(avatarUpdatedAt), "d MMM '·' HH:mm", { locale: es }) : null
  const subtitulo = !avatarPath
    ? `${pacienteNombreCompleto} · sin foto`
    : `Actualizada por ${avatarOrigen === 'paciente' ? 'el paciente' : 'tu equipo'} · ${fecha}`

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title="Foto del paciente"
      subtitle={subtitulo}
      subtitleCapitalize={false}
      width="narrow"
      noPadding
      footer={
        <div className="fp-so-foot">
          {avatarPath && (
            <button type="button" className="btn dng" disabled={busy} onClick={quitar}>
              {busy && removing ? <span className="fp-spin" /> : null}
              {busy && removing ? 'Quitando…' : 'Quitar foto'}
            </button>
          )}
          <button type="button" className="btn" disabled={busy} onClick={handleClose}>Cancelar</button>
          <button type="button" className="btn primary" disabled={!canSave} onClick={guardar}>
            {busy && !removing ? <span className="fp-spin" /> : null}
            {busy && !removing ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      }
    >
      <div style={{ padding: '24px 20px' }}>
        <div
          ref={cropRef}
          className={`crop${!imgSrc ? ' empty' : ''}${bloqueado ? ' busy' : ''}${dragOver ? ' drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!imgSrc ? (
            <>
              <div className="big-av">{iniciales}</div>
              <p>Arrastrá una foto acá o elegí un archivo.</p>
            </>
          ) : (
            <>
              <img
                src={imgSrc}
                alt="Vista previa del recorte"
                draggable={false}
                style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}
              />
              <span className="crop-mask" />
              {bloqueado && <span className="crop-spin" aria-label="Cargando" />}
            </>
          )}
        </div>

        {imgSrc && (
          <div className="zoom">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M21 21l-4.3-4.3" /></svg>
            <input
              type="range" min={1} max={3} step={0.01} value={zoom} aria-label="Zoom"
              disabled={bloqueado}
              style={{ '--p': `${((zoom - 1) / 2) * 100}%` } as React.CSSProperties}
              onChange={onZoomChange}
            />
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M11 8v6M21 21l-4.3-4.3" /></svg>
          </div>
        )}

        {error && (
          <div className="inote dng pf-err" role="alert">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            <span className="tx">{ERR[error]}</span>
          </div>
        )}

        <p className="pf-note">Cargá la foto solo si el paciente lo autorizó.</p>

        <div className="pf-pick">
          <button type="button" className="btn" disabled={bloqueado} onClick={() => abrirSelector('gal')}>
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
            {imgSrc ? 'Elegir otra foto' : 'Elegir archivo'}
          </button>
          <button type="button" className="btn only-touch" disabled={bloqueado} onClick={() => abrirSelector('cam')}>
            <svg viewBox="0 0 24 24"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
            Sacar foto
          </button>
        </div>

        <p className="pf-fmt">JPG, PNG o HEIC · hasta 10 MB. {pacientePrimerNombre} también puede cambiarla desde su portal.</p>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif" hidden onChange={onFileChange} />
      </div>
    </SlideOver>
  )
}
