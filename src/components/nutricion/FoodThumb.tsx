'use client'

import { useEffect, useRef, useState } from 'react'
import './food-thumb.css'

type Size = 36 | 40 | 44 | 48 | 56 | 64

interface Props {
  size: Size
  src?: string | null
}

const PLATE = (
  <svg className="fg" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.6" />
    <path d="M3.8 4.5v4.1a1.6 1.6 0 0 0 3.2 0V4.5M5.4 10.2v9.3" />
    <path d="M20.2 19.5V4.5c-1.7 1.2-2.6 3.4-2.6 6v2.2h2.6" />
  </svg>
)

// Solo presentación — no dispara generación ni llama a ningún endpoint.
// "Sin imagen", "generando" y "error" se ven todos iguales: el glifo de
// plato de arriba, sin <img>. La fila nunca cambia de alto: .fimg tiene
// tamaño fijo por la clase sNN, con o sin imagen real.
export default function FoodThumb({ size, src }: Props) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setError(false)
    setLoaded(false)
  }, [src])

  useEffect(() => {
    // Si la imagen ya estaba en caché del navegador, onLoad puede no
    // disparar — chequeo al montar para que no quede invisible.
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0) setLoaded(true)
  }, [src])

  const mostrarImg = !!src && !error

  return (
    <span className={`fimg s${size}`} aria-hidden="true">
      {PLATE}
      {mostrarImg && (
        <img
          ref={imgRef}
          src={src}
          width={200}
          height={200}
          alt=""
          loading="lazy"
          decoding="async"
          className={loaded ? 'in' : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </span>
  )
}
