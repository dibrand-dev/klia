'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { PasswordField, PasswordRequirementsList, passwordRequisitos } from '@/components/portal/password'
import '@/components/portal/portal.css'

function iniciales(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/)
  return `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}`.toUpperCase()
}

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

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

  const [info, setInfo] = useState<{ profesionalNombre: string; especialidad: string | null; pacienteEmail: string; diasRetencion: number | null } | null>(null)

  const [password, setPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [aceptaConsentimiento, setAceptaConsentimiento] = useState(false)
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
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      setSesionValida(!!user)
      setCheckingSession(false)

      if (user) {
        const res = await fetch('/api/portal/invitacion-info')
        const body = await jsonOrNull(res)
        if (res.ok) setInfo(body)
      }
    }

    resolver()
  }, [])

  async function handleActivar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!passwordRequisitos(password, confirmarPassword).every((r) => r.ok) || !aceptaConsentimiento) return

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
      const body = await jsonOrNull(activarRes)
      setError(body?.message ?? 'No pudimos activar tu cuenta. Intentá de nuevo.')
      setLoading(false)
      return
    }

    router.push('/portal')
  }

  if (checkingSession) {
    return <div className="pp-shell auth-mode"><main className="pp-main" style={{ padding: 0 }}><div className="pp-auth"><p className="pp-lead">Verificando invitación...</p></div></main></div>
  }

  if (!sesionValida) {
    return (
      <div className="pp-shell auth-mode">
        <main className="pp-main" style={{ padding: 0 }}>
          <div className="pp-auth">
            <h1>Link no válido</h1>
            <p className="pp-lead">
              {inviteExpired
                ? 'Esta invitación ya fue utilizada o venció. Pedile a tu profesional que te la reenvíe.'
                : 'Este link ya no es válido o ya fue usado. Pedile a tu profesional que te lo reenvíe.'}
            </p>
            <p className="pp-lead">Si ya activaste tu cuenta, ingresá con tu email y contraseña.</p>
            <button type="button" className="pp-pb pri full" onClick={() => router.push('/portal/login')}>Ir a iniciar sesión</button>
          </div>
        </main>
      </div>
    )
  }

  const diasRetencion = info?.diasRetencion ?? 60
  const puedeEnviar = passwordRequisitos(password, confirmarPassword).every((r) => r.ok) && aceptaConsentimiento

  return (
    <div className="pp-shell auth-mode">
      <main className="pp-main" style={{ padding: 0 }}>
        <div className="pp-auth">
          <Image src="/logo.svg" alt="KLIA" width={92} height={24} className="pp-auth-logo" style={{ height: 24, width: 'auto' }} />

          {info && (
            <div className="pp-inv">
              <div className="pp-av">{iniciales(info.profesionalNombre)}</div>
              <div><b>{info.profesionalNombre}</b><span>{info.especialidad ?? 'Portal del paciente'}</span></div>
            </div>
          )}

          <h1>Activá tu cuenta</h1>
          <p className="pp-lead">{info?.profesionalNombre ?? 'Tu profesional'} te invitó a su portal de pacientes. Desde acá vas a ver tu plan alimentario y registrar tus comidas con una foto.</p>

          <div className="pp-af">
            <label htmlFor="a-em">Email</label>
            <input id="a-em" type="email" value={info?.pacienteEmail ?? ''} readOnly />
          </div>

          <form onSubmit={handleActivar}>
            <PasswordField id="a-p1" label="Contraseña" autoComplete="new-password" value={password} onChange={setPassword} />
            <PasswordField id="a-p2" label="Confirmar contraseña" autoComplete="new-password" value={confirmarPassword} onChange={setConfirmarPassword} />
            <PasswordRequirementsList a={password} b={confirmarPassword} />

            <label className="pp-ck">
              <input type="checkbox" checked={aceptaConsentimiento} onChange={(e) => setAceptaConsentimiento(e.target.checked)} />
              <span className="pp-bx"><svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: '#fff', strokeWidth: 3, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg></span>
              <span className="pp-ctx">Acepto que <b>mis fotos y comentarios son visibles solo para mi profesional.</b> Se conservan {diasRetencion} días y luego se eliminan.</span>
            </label>

            {error && <p style={{ color: 'var(--danger)', fontSize: 13.5, marginTop: -8, marginBottom: 16 }}>{error}</p>}

            <button type="submit" className="pp-pb pri full" disabled={!puedeEnviar || loading}>{loading ? 'Creando...' : 'Crear mi cuenta'}</button>
          </form>
          <p className="pp-alt">¿Ya tenés cuenta? <button className="pp-lnk" onClick={() => router.push('/portal/login')}>Ingresá</button></p>
        </div>
      </main>
    </div>
  )
}
