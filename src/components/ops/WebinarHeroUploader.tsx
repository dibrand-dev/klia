'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  imagenUrl: string | null
  onUpload: (url: string) => void
  onRemove: () => void
}

type Estado = 'idle' | 'uploading' | 'error'

const MAX_BYTES = 3 * 1024 * 1024
const BUCKET = 'webinar-heroes'
const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp']

export default function WebinarHeroUploader({ imagenUrl, onUpload, onRemove }: Props) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!TIPOS_ACEPTADOS.includes(file.type)) {
      setEstado('error')
      setErrorMsg('Solo se aceptan imágenes JPG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setEstado('error')
      setErrorMsg('La imagen supera el límite de 3 MB.')
      return
    }

    setEstado('uploading')
    setErrorMsg(null)

    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const storagePath = `${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { contentType: file.type })

    if (upErr) {
      setEstado('error')
      setErrorMsg(upErr.message)
      return
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    setEstado('idle')
    onUpload(data.publicUrl)
  }

  if (imagenUrl) {
    return (
      <div className="flex flex-col gap-3">
        <div className="w-full aspect-video rounded-xl overflow-hidden border border-outline-variant/20 bg-surface-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagenUrl} alt="Imagen hero" className="w-full h-full object-cover" />
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-lg border border-outline-variant/30 bg-surface-container hover:bg-surface-container-high transition-colors font-medium text-on-surface-variant"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors font-medium text-red-600"
          >
            Quitar imagen
          </button>
        </div>

        {errorMsg && <p className="text-xs text-red-600 font-medium">{errorMsg}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={estado === 'uploading'}
        className="w-full border-2 border-dashed border-outline-variant/40 rounded-xl px-6 py-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-surface-container/50 transition-colors disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">
          {estado === 'uploading' ? 'progress_activity' : 'add_photo_alternate'}
        </span>
        <span className="text-sm font-medium text-on-surface">Subir imagen hero</span>
        <span className="text-xs text-on-surface-variant">Sugerido 16:9 — JPG, PNG o WEBP, máx. 3 MB</span>
        <span className="text-xs text-primary font-medium mt-1">
          {estado === 'uploading' ? 'Subiendo...' : 'Seleccionar imagen'}
        </span>
      </button>

      {errorMsg && <p className="text-xs text-red-600 font-medium">{errorMsg}</p>}
    </div>
  )
}
