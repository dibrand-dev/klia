'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  alimentoId: string
  imageUrl: string | null
  imageStatus: 'pending' | 'generating' | 'ready' | 'failed'
  alt: string
  size?: number
}

// No está integrado en ninguna pantalla todavía (editor de plan, dropdown de
// búsqueda, link público, portal del paciente) — no hay diseño pixel-perfect
// para ninguna de las 4, así que no se inventa UI. Queda listo para cuando
// haya un diseño real que lo pida.
export default function FoodImage({ alimentoId, imageUrl, imageStatus, alt, size = 64 }: Props) {
  const [url, setUrl] = useState(imageUrl)
  const [status, setStatus] = useState(imageStatus)
  const disparado = useRef(false)

  useEffect(() => {
    if (status !== 'pending' || disparado.current) return
    disparado.current = true
    fetch(`/api/foods/${alimentoId}/image`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.image_url) setUrl(data.image_url)
        if (data?.image_status) setStatus(data.image_status)
      })
      .catch(() => {
        // Sin reintento — si falla la llamada, queda 'pending' y el próximo
        // render que vuelva a montar el componente lo vuelve a intentar.
      })
  }, [alimentoId, status])

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} width={size} height={size} style={{ width: size, height: size, borderRadius: 'var(--r-md, 8px)', objectFit: 'cover', flexShrink: 0 }} />
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: 'var(--r-md, 8px)', flexShrink: 0,
        background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)',
        display: 'grid', placeItems: 'center', color: 'var(--muted-3, #AEB5C0)',
      }}
    >
      <svg viewBox="0 0 24 24" style={{ width: size * 0.4, height: size * 0.4, stroke: 'currentColor', strokeWidth: 1.6, fill: 'none' }}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  )
}
