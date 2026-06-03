'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NuevaContrasenaPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // Parse access_token and refresh_token from URL hash (implicit flow)
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(() => setSessionReady(true))
        .catch(() => setError('El link expiró. Solicitá uno nuevo desde la pantalla de login.'))
    } else {
      // PKCE flow: session already set by exchangeCodeForSession in the callback route
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setSessionReady(true)
        else setError('El link expiró. Solicitá uno nuevo desde la pantalla de login.')
      })
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      router.push('/dashboard')
    } catch {
      setError('No se pudo actualizar la contraseña. El link puede haber expirado.')
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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.015em' }}>
          Creá tu nueva contraseña
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Elegí una contraseña segura de al menos 8 caracteres.
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
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: 'var(--muted-2)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 6,
            }}>
              Nueva contraseña <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              style={{
                width: '100%', border: '1px solid var(--border)', borderRadius: 8,
                padding: '0 12px', height: 40, fontSize: 14,
                color: 'var(--ink)', background: 'var(--surface)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: 'var(--muted-2)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 6,
            }}>
              Confirmá la contraseña <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repetí la contraseña"
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
            disabled={loading || !sessionReady}
            style={{
              width: '100%', padding: '10px 16px', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: (loading || !sessionReady) ? 'not-allowed' : 'pointer',
              border: 'none', background: 'var(--ink)', color: 'white',
              opacity: (loading || !sessionReady) ? 0.7 : 1, transition: 'opacity .15s ease',
            }}
          >
            {loading ? 'Guardando...' : !sessionReady ? 'Verificando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
