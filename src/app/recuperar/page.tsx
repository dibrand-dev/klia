'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setEnviado(true)
    } catch {
      setError('Ocurrió un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#F5F6FA', fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '24px 16px',
    }}>
      <div style={{ marginBottom: 32 }}>
        <Image src="/logo.svg" alt="KLIA" width={80} height={36} style={{ height: 36, width: 'auto' }} />
      </div>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'white', borderRadius: 16,
        border: '1px solid var(--border)',
        padding: '32px 28px',
        boxShadow: '0 4px 24px rgba(0,26,72,0.07)',
      }}>
        {enviado ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--ok-soft)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5L9.5 17L19 7" stroke="var(--ok)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              Email enviado
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
              Revisá tu bandeja de entrada. Si el email existe en KLIA, recibirás el link en unos minutos.
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted-2)', margin: 0 }}>
              También revisá la carpeta de spam.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.015em' }}>
              Recuperá tu contraseña
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
              Ingresá tu email y te enviamos un link para crear una nueva contraseña.
            </p>

            {error && (
              <div style={{
                background: 'var(--danger-soft)', border: '1px solid var(--danger)',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: 'var(--danger)', marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 600,
                  color: 'var(--muted-2)', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 6,
                }}>
                  Email <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={{
                    width: '100%', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '0 12px', height: 40, fontSize: 14,
                    color: 'var(--ink)', background: 'var(--surface)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  border: 'none', background: 'var(--ink)', color: 'white',
                  opacity: loading ? 0.7 : 1, transition: 'opacity .15s ease',
                }}
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link href="/login" style={{
                fontSize: 13, color: 'var(--muted)', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Volver al inicio de sesión
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
