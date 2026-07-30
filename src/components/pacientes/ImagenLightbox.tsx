'use client'

import { useEffect, useState } from 'react'

interface Props {
  src: string
  nombre: string
  onClose: () => void
}

export default function ImagenLightbox({ src, nombre, onClose }: Props) {
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{nombre}</p>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-black/5 flex-shrink-0"
          style={{ color: 'var(--ink)' }}
          aria-label="Cerrar"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
        </button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={nombre}
          onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z) }}
          className={zoomed ? 'max-w-none cursor-zoom-out' : 'max-w-full max-h-full object-contain cursor-zoom-in'}
        />
      </div>
    </div>
  )
}
