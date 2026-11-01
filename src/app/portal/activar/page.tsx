'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/

// TEMPORAL — sin estilos, se reemplaza con el diseño real. Mismo patrón que
// /colaboradora/activar: el token de invitación viaja en el hash de la URL
// (nunca llega al server) y se intercambia por una sesión del lado del cliente.
export default function PortalActivarPage() {
  return (
    <Suspense fallback={null}>
      <PortalActivarContent />
    </Suspense>
  )
}

function PortalActivarContent() {
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

    const activarRes = await fetch('/api/portal/activar', { method: 'POST' })
    if (!activarRes.ok) {
      const body = await activarRes.json().catch(() => null)
      setError(body?.message ?? 'No pudimos activar tu cuenta. Intentá de nuevo.')
      setLoading(false)
      return
    }

    router.push('/portal')
  }

  if (checkingSession) {
    return <p style={{ padding: 32, fontFamily: 'sans-serif' }}>Verificando invitación...</p>
  }

  if (!sesionValida) {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <h1>Link no válido</h1>
        <p>
          {inviteExpired
            ? 'Esta invitación ya fue utilizada o venció. Pedile a tu profesional que te la reenvíe.'
            : 'Este link ya no es válido o ya fue usado. Pedile a tu profesional que te lo reenvíe.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 320 }}>
      <h1>Activá tu cuenta del portal</h1>
      <form onSubmit={handleActivar} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label>
          Contraseña
          <input
            type="password" required autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Confirmar contraseña
          <input
            type="password" required autoComplete="new-password"
            value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)}
          />
        </label>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Activando...' : 'Activar cuenta'}
        </button>
      </form>
    </div>
  )
}
