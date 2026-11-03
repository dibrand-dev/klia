'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { PasswordField, PasswordRequirementsList, passwordRequisitos } from '@/components/portal/password'
import '@/components/portal/portal.css'

// Reutiliza el layout de Activar (logo, h1, campos de contraseña +
// checklist) pero sin el bloque de invitación ni el checkbox de
// consentimiento, que no aplican a un simple cambio de contraseña. Copy
// provisorio — avisado al pedir esta pantalla.
export default function PortalNuevaContrasenaPage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [sesionValida, setSesionValida] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    // A diferencia de Activar, acá no hay hash que leer: /auth/callback ya
    // canjeó el código del link de recuperación server-side y la cookie de
    // sesión ya está puesta cuando el navegador llega a esta página.
    supabase.auth.getSession().then(({ data }) => {
      setSesionValida(!!data.session)
      setCheckingSession(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!passwordRequisitos(password, confirmarPassword).every((r) => r.ok)) return

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('No pudimos actualizar tu contraseña. El link puede haber expirado.')
      return
    }

    router.push('/portal')
  }

  if (checkingSession) {
    return <div className="pp-shell auth-mode"><main className="pp-main" style={{ padding: 0 }}><div className="pp-auth"><p className="pp-lead">Verificando el link...</p></div></main></div>
  }

  if (!sesionValida) {
    return (
      <div className="pp-shell auth-mode">
        <main className="pp-main" style={{ padding: 0 }}>
          <div className="pp-auth">
            <h1>Link no válido</h1>
            <p className="pp-lead">Este link ya no es válido o venció. Solicitá uno nuevo desde la pantalla de ingreso.</p>
            <button className="pp-pb pri full" onClick={() => router.push('/portal/login')}>Volver a ingresar</button>
          </div>
        </main>
      </div>
    )
  }

  const puedeEnviar = passwordRequisitos(password, confirmarPassword).every((r) => r.ok)

  return (
    <div className="pp-shell auth-mode">
      <main className="pp-main" style={{ padding: 0 }}>
        <div className="pp-auth">
          <Image src="/logo.svg" alt="KLIA" width={92} height={24} className="pp-auth-logo" style={{ height: 24, width: 'auto' }} />
          <h1>Elegí una nueva contraseña</h1>
          <p className="pp-lead">Creá una contraseña nueva para tu cuenta del portal.</p>

          <form onSubmit={handleSubmit}>
            <PasswordField id="n-p1" label="Nueva contraseña" autoComplete="new-password" value={password} onChange={setPassword} />
            <PasswordField id="n-p2" label="Confirmar contraseña" autoComplete="new-password" value={confirmarPassword} onChange={setConfirmarPassword} />
            <PasswordRequirementsList a={password} b={confirmarPassword} />

            {error && <p style={{ color: 'var(--danger)', fontSize: 13.5, marginTop: -8, marginBottom: 16 }}>{error}</p>}

            <button type="submit" className="pp-pb pri full" disabled={!puedeEnviar || loading}>{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
          </form>
        </div>
      </main>
    </div>
  )
}
