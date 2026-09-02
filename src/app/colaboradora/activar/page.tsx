'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/ui/Logo'

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/

export default function ActivarColaboradoraPage() {
  return (
    <Suspense fallback={null}>
      <ActivarColaboradoraContent />
    </Suspense>
  )
}

function ActivarColaboradoraContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteExpired = searchParams.get('error') === 'invite_expired'
  const [checkingSession, setCheckingSession] = useState(true)
  const [sesionValida, setSesionValida] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function resolver() {
      const supabase = createClient()
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      setSesionValida(!!user)
      setCheckingSession(false)
    }

    resolver()
  }, [])

  async function handleActivar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!PASSWORD_REGEX.test(password)) {
      setError('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.')
      return
    }
    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('No pudimos activar tu cuenta. Intentá de nuevo.')
      setLoading(false)
      return
    }

    const activarRes = await fetch('/api/colaboradores/activar', { method: 'POST' })
    if (!activarRes.ok) {
      setError('No pudimos activar tu cuenta. Intentá de nuevo.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F5F6FA', gap: 24 }}>
        <Logo className="h-8 w-auto opacity-80" />
        <p style={{ fontSize: 14, color: '#8A93A1', margin: 0 }}>Verificando invitación...</p>
      </div>
    )
  }

  if (!sesionValida) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F5F6FA', gap: 24 }}>
        <Logo className="h-8 w-auto" />
        <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Link no válido</h1>
          <p style={{ fontSize: 14, color: '#5B6472' }}>
            {inviteExpired
              ? 'Esta invitación ya fue utilizada o venció. Pedile a tu profesional que te reenvíe la invitación desde Ajustes.'
              : 'Este link ya no es válido o ya fue usado. Pedile al profesional que te reenvíe la invitación.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F5F6FA', gap: 24 }}>
      <Logo className="h-8 w-auto" />
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Activá tu cuenta</h1>
        <p style={{ fontSize: 13, color: '#5B6472', marginBottom: 20 }}>Elegí una contraseña para empezar a usar KLIA.</p>

        <form onSubmit={handleActivar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Contraseña</label>
            <input
              id="password" type="password" required autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E5EA', fontSize: 14 }}
            />
          </div>
          <div>
            <label htmlFor="confirmarPassword" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Confirmar contraseña</label>
            <input
              id="confirmarPassword" type="password" required autoComplete="new-password"
              value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E5EA', fontSize: 14 }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#B42318', background: '#FBECEA', borderRadius: 8, padding: '8px 12px' }}>{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            style={{ marginTop: 6, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#0B1220', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Activando...' : 'Activar cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
