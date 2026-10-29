'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  onTranscription: (text: string, duracionSegundos?: number) => void
  onError: (error: string) => void
  maxSeconds?: number
  // 'nota': skin pixel-perfect del diseño de estados de voz de la nota
  // clínica (.voz .ns-mic, .ns-rec, .ns-timer, etc. — ver nota-especialidad.css).
  // Por defecto ('default') el comportamiento y el aspecto no cambian.
  variant?: 'default' | 'nota'
  // Avisa al padre cuando entra/sale del estado "transcribiendo" (para
  // bloquear el toggle Voz/Escribir mientras tanto). Opcional.
  onTranscribingChange?: (transcribiendo: boolean) => void
}

type Estado = 'idle' | 'recording' | 'transcribing' | 'done' | 'error-mic' | 'error-transcribe'

function formatTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function VoiceRecorder({ onTranscription, onError, maxSeconds = 300, variant = 'default', onTranscribingChange }: Props) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [duracionGrabada, setDuracionGrabada] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeTypeRef = useRef<string>('audio/webm')
  const blobPendienteRef = useRef<Blob | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => {
    onTranscribingChange?.(estado === 'transcribing')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm'

      mimeTypeRef.current = mimeType
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = handleStop

      mediaRecorder.start(250)
      setEstado('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1
          if (next >= maxSeconds) {
            stopRecording()
            return prev
          }
          return next
        })
      }, 1000)
    } catch {
      if (variant === 'nota') {
        setEstado('error-mic')
      }
      onError('No se pudo acceder al micrófono. Verificá los permisos del browser.')
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') {
      mr.stop()
      mr.stream.getTracks().forEach(t => t.stop())
    }
  }

  async function handleStop() {
    setEstado('transcribing')
    const blobType = mimeTypeRef.current.split(';')[0]
    const blob = new Blob(chunksRef.current, { type: blobType })
    setDuracionGrabada(elapsed)

    if (blob.size < 100) {
      onError('La grabación está vacía. Intentá de nuevo.')
      setEstado('idle')
      setElapsed(0)
      return
    }

    blobPendienteRef.current = blob
    await transcribirBlob(blob)
  }

  async function transcribirBlob(blob: Blob) {
    const blobType = blob.type || mimeTypeRef.current.split(';')[0]
    const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm'
    const form = new FormData()
    form.append('audio', blob, `nota.${ext}`)

    try {
      const res = await fetch('/api/notas/transcribir', { method: 'POST', body: form })
      const data = await res.json() as { text?: string; error?: string }
      if (data.text) {
        blobPendienteRef.current = null
        if (variant === 'nota') {
          setEstado('done')
          setTimeout(() => onTranscription(data.text!, duracionGrabada), 1200)
        } else {
          onTranscription(data.text)
          setEstado('done')
          setTimeout(() => setEstado('idle'), 2500)
        }
      } else {
        const msg = data.error ?? 'No se pudo transcribir el audio. Intentá de nuevo.'
        onError(msg)
        setEstado(variant === 'nota' ? 'error-transcribe' : 'idle')
      }
    } catch {
      onError('Error de conexión. Intentá de nuevo.')
      setEstado(variant === 'nota' ? 'error-transcribe' : 'idle')
    }
    if (variant !== 'nota') setElapsed(0)
  }

  function reintentarTranscripcion() {
    if (blobPendienteRef.current) {
      setEstado('transcribing')
      transcribirBlob(blobPendienteRef.current)
    }
  }

  function grabarDeNuevo() {
    blobPendienteRef.current = null
    setElapsed(0)
    setEstado('idle')
  }

  const nearLimit = elapsed >= maxSeconds - 30

  if (variant === 'nota') {
    if (estado === 'idle') {
      return (
        <div className="voz">
          <button type="button" className="ns-mic" onClick={startRecording} aria-label="Dictar">
            <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          <p>Tocá para dictar. Klia transcribe y ordena la nota; los datos del examen se completan a mano.</p>
        </div>
      )
    }

    if (estado === 'recording') {
      return (
        <div className="voz" aria-live="polite">
          <span className="ns-rec"><span className="ns-pulse" />Grabando</span>
          <span className={`ns-timer${nearLimit ? ' w' : ''}`}>{formatTime(elapsed)}<small>/ {formatTime(maxSeconds)}</small></span>
          {nearLimit && (
            <span className="ns-warnl">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              Quedan {maxSeconds - elapsed} s. Después se transcribe solo.
            </span>
          )}
          <button type="button" className="ns-b ns-pr" onClick={stopRecording}>
            <span className="sq" />Detener y transcribir
          </button>
        </div>
      )
    }

    if (estado === 'transcribing') {
      return (
        <div className="voz" aria-busy="true">
          <span className="ns-spin" />
          <div className="ns-tx">
            <p className="ns-t">Transcribiendo…</p>
            <p>Audio de {formatTime(duracionGrabada)} · suele tardar unos segundos.</p>
          </div>
          <span className="ns-bar"><i /></span>
        </div>
      )
    }

    if (estado === 'done') {
      return (
        <div className="voz okz" role="status">
          <span className="ns-ic ok">
            <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
          </span>
          <div className="ns-tx">
            <p className="ns-t">Transcripción lista</p>
            <p>Agregamos el texto a la nota. Revisalo antes de guardar.</p>
          </div>
        </div>
      )
    }

    if (estado === 'error-mic') {
      return (
        <div className="voz" role="alert">
          <span className="ns-ic er">
            <svg viewBox="0 0 24 24"><path d="M3 3l18 18M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.9 5M19 11a7 7 0 0 1-.6 2.8M12 18v3" /></svg>
          </span>
          <div className="ns-tx">
            <p className="ns-t">No tenemos acceso al micrófono</p>
            <p>Habilitalo desde el candado de la barra del navegador y reintentá.</p>
          </div>
          <button type="button" className="ns-b" onClick={startRecording}>
            <svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" /></svg>
            Reintentar
          </button>
        </div>
      )
    }

    // error-transcribe
    return (
      <div className="voz" role="alert">
        <span className="ns-ic er">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
        </span>
        <div className="ns-tx">
          <p className="ns-t">No pudimos transcribir el audio</p>
          <p>Tu grabación de {formatTime(duracionGrabada)} quedó guardada. Reintentá sin volver a grabar.</p>
        </div>
        <div className="ns-bb">
          <button type="button" className="ns-b" onClick={reintentarTranscripcion}>
            <svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" /></svg>
            Reintentar
          </button>
          <button type="button" className="ns-lk" onClick={grabarDeNuevo}>Grabar de nuevo</button>
        </div>
      </div>
    )
  }

  if (estado === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="w-full flex items-center justify-center gap-2 py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
      >
        <span className="material-symbols-outlined text-3xl">mic</span>
        <span className="text-sm font-medium">Tocar para grabar nota de voz</span>
      </button>
    )
  }

  if (estado === 'recording') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="relative flex items-center justify-center">
          <span className="absolute w-16 h-16 rounded-full bg-red-400 opacity-30 animate-ping" />
          <span className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">mic</span>
          </span>
        </div>
        <p className="text-2xl font-mono font-semibold text-gray-800 tabular-nums">{formatTime(elapsed)}</p>
        {nearLimit && (
          <p className="text-xs text-amber-600 font-medium">
            ⚠️ Quedan {maxSeconds - elapsed}s de grabación
          </p>
        )}
        <button
          type="button"
          onClick={stopRecording}
          className="mt-2 px-6 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition-colors"
        >
          Detener grabación
        </button>
      </div>
    )
  }

  if (estado === 'transcribing') {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Transcribiendo...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <span className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
        <span className="material-symbols-outlined text-emerald-600 text-2xl">check_circle</span>
      </span>
      <p className="text-sm text-gray-600 font-medium">¡Transcripción completada!</p>
    </div>
  )
}
