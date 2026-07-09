'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[error boundary]', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0B1220', margin: 0 }}>
        Algo salió mal
      </h1>
      <p style={{ fontSize: 14, color: '#5B6472', maxWidth: 420, margin: 0 }}>
        Ocurrió un error inesperado. Podés intentar de nuevo — si el problema persiste, escribinos a{' '}
        <a href="mailto:hola@klia.com.ar" style={{ color: '#4F46E5', fontWeight: 600 }}>
          hola@klia.com.ar
        </a>
        .
      </p>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          borderRadius: 10,
          border: 'none',
          background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
          color: 'white',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Volver a intentar
      </button>
    </div>
  )
}
