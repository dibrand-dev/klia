'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  onTranscription: (text: string) => void
  onError: (error: string) => void
  maxSeconds?: number
}

type Estado = 'idle' | 'recording' | 'transcribing' | 'done'

function formatTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function VoiceRecorder({ onTranscription, onError, maxSeconds = 300 }: Props) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [elapsed, setElapsed] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeTypeRef = useRef<string>('audio/webm')

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

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

    if (blob.size < 100) {
      onError('La grabación está vacía. Intentá de nuevo.')
      setEstado('idle')
      return
    }

    const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm'
    const form = new FormData()
    form.append('audio', blob, `nota.${ext}`)

    try {
      const res = await fetch('/api/notas/transcribir', { method: 'POST', body: form })
      const data = await res.json() as { text?: string; error?: string }
      if (data.text) {
        onTranscription(data.text)
        setEstado('done')
        setTimeout(() => setEstado('idle'), 2500)
      } else {
        onError(data.error ?? 'No se pudo transcribir el audio. Intentá de nuevo.')
        setEstado('idle')
      }
    } catch {
      onError('Error de conexión. Intentá de nuevo.')
      setEstado('idle')
    }
    setElapsed(0)
  }

  const nearLimit = elapsed >= maxSeconds - 30

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
