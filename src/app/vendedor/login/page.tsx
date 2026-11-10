'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconAlert, IconBack, IconEye, IconMail } from '../icons'

const MENSAJE_GENERICO = 'No pudimos ingresar. Revisá tus datos o contactá a soporte en hola@klia.com.ar'

type Vista = 'login' | 'recuperar' | 'enviado'

function LgShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg-split">
      <section className="lg-pane">
        <div className="lg-in">
          <img src="/logo.svg" alt="Klia" className="logo" />
          {children}
        </div>
        <p className="lg-foot">© {new Date().getFullYear()} KLIA · <a href="https://www.klia.com.ar/privacidad" target="_blank" rel="noopener noreferrer">Privacidad</a></p>
      </section>
      <aside className="lg-art" aria-hidden="true">
        <img src="/vendedor-login.jpg" alt="" />
      </aside>
    </div>
  )
}

export default function VendedorLoginPage() {
  const [vista, setVista] = useState<Vista>('login')
  const [emailEnviado, setEmailEnviado] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [recEmail, setRecEmail] = useState('')
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    // Mensaje único para credenciales inválidas y cuenta suspendida (Supabase
    // devuelve el mismo error de credenciales para ambos casos, ya que una
    // cuenta "baneada" rechaza el signInWithPassword) — no se diferencia a
    // propósito, para no revelar si el email existe o si está suspendido.
    if (authError || !user) {
      console.error('[vendedor/login] signInWithPassword error:', authError)
      if (authError?.status === 429 || authError?.code === 'over_request_rate_limit') {
        setError('Demasiados intentos de inicio de sesión. Esperá unos minutos y volvé a intentar.')
      } else {
        setError(MENSAJE_GENERICO)
      }
      setLoading(false)
      return
    }

    const { error: resumenError } = await supabase.rpc('vendedor_get_resumen')

    if (resumenError) {
      await supabase.auth.signOut()
      setError(MENSAJE_GENERICO)
      setLoading(false)
      return
    }

    window.location.href = '/vendedor'
  }

  async function handleRecSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!recEmail.includes('@')) {
      setRecError('Ingresá un email válido.')
      return
    }
    setRecLoading(true)
    setRecError(null)

    await fetch('/api/vendedor/recuperar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: recEmail.trim() }),
    }).catch(() => {})

    setEmailEnviado(recEmail.trim())
    setRecLoading(false)
    setVista('enviado')
  }

  if (vista === 'enviado') {
    return (
      <LgShell>
        <div className="lg-ok"><IconMail width={21} height={21} stroke="var(--ok)" strokeWidth={1.8} fill="none" /></div>
        <h1>Revisá tu email</h1>
        <p className="sub">Si <b>{emailEnviado}</b> está registrado con Acceso Comercial, te enviamos un link para crear una contraseña nueva. Vence en 60 minutos.</p>
        <button type="button" className="btn primary lg-btn" onClick={() => setVista('login')}>Volver a ingresar</button>
        <p className="lg-alt">¿No te llegó? Revisá spam o escribinos a <a href="mailto:hola@klia.com.ar">hola@klia.com.ar</a>.</p>
      </LgShell>
    )
  }

  if (vista === 'recuperar') {
    return (
      <LgShell>
        <button type="button" className="lg-back" onClick={() => setVista('login')}>
          <IconBack width={15} height={15} stroke="currentColor" strokeWidth={1.8} fill="none" />Volver
        </button>
        <h1>Recuperá tu contraseña</h1>
        <p className="sub">Ingresá el email con el que entrás al panel y te mandamos un link para crear una nueva.</p>
        <form onSubmit={handleRecSubmit} noValidate>
          <div className={`af${recError ? ' err' : ''}`}>
            <label htmlFor="rc-e">Email</label>
            <input id="rc-e" type="email" autoComplete="email" placeholder="tu@email.com" value={recEmail} onChange={e => setRecEmail(e.target.value)} disabled={recLoading} />
            {recError && <span className="ferr">{recError}</span>}
          </div>
          <button type="submit" className="btn primary lg-btn" disabled={recLoading}>
            {recLoading ? <><span className="spin" />Enviando…</> : 'Enviar link'}
          </button>
        </form>
      </LgShell>
    )
  }

  return (
    <LgShell>
      <h1>Acceso Comercial</h1>
      <p className="sub">Ingresá con tu email y contraseña para ver tus clientes y comisiones.</p>
      {error && (
        <div className="alert-box" role="alert">
          <IconAlert width={16} height={16} stroke="currentColor" strokeWidth={1.8} fill="none" />
          <div><b>{error}</b></div>
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="af">
          <label htmlFor="lg-e">Email</label>
          <input id="lg-e" type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
        </div>
        <div className="af">
          <label htmlFor="lg-p">Contraseña</label>
          <div className="iw">
            <input
              id="lg-p" className="pw" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
              placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading}
            />
            <button type="button" className="eye" aria-label="Mostrar contraseña" onClick={() => setShowPassword(v => !v)}>
              <IconEye width={15} height={15} stroke="var(--muted)" strokeWidth={1.7} fill="none" />
            </button>
          </div>
        </div>
        <div className="lg-row">
          <button type="button" onClick={() => setVista('recuperar')}>Olvidé mi contraseña</button>
        </div>
        <button type="submit" className="btn primary lg-btn" disabled={loading}>
          {loading ? <><span className="spin" />Ingresando…</> : 'Ingresar'}
        </button>
      </form>
    </LgShell>
  )
}
