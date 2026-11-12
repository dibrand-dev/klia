'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import '@/components/portal/portal.css'

const IconAlert = <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>
const IconX = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'var(--ink-2)', strokeWidth: 1.8, fill: 'none' }}><path d="M6 6l12 12M18 6L6 18" /></svg>
const IconMail = <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>

export default function PortalLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const olvideBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!sheetOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setSheetOpen(false)
      olvideBtnRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sheetOpen])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)

    if (!email || !password) {
      setLoginError('Completá tu email y tu contraseña.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })

    if (error) {
      setLoginError('El email o la contraseña no son correctos.')
      setLoading(false)
      return
    }

    router.push('/portal')
  }

  function abrirOlvide() {
    setForgotEmail(email)
    setSent(false)
    setSheetOpen(true)
  }

  async function enviarRecuperacion(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    await fetch('/api/portal/recuperar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail }),
    }).catch(() => {})
    setSending(false)
    setSent(true)
  }

  return (
    <div className="pp-shell auth-mode">
      <main className="pp-main" style={{ padding: 0 }}>
        <div className="pp-auth">
          <Image src="/logo.svg" alt="KLIA" width={92} height={24} className="pp-auth-logo" style={{ height: 24, width: 'auto' }} />
          <h1>Ingresá a tu portal</h1>
          <p className="pp-lead">Tu plan alimentario y el registro de tus comidas, en un solo lugar.</p>

          {loginError && (
            <div className="pp-note danger" style={{ margin: '0 0 16px' }} role="alert">{IconAlert}<span>{loginError}</span></div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className={`pp-af${loginError ? ' err' : ''}`}>
              <label htmlFor="l-em">Email</label>
              <input id="l-em" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className={`pp-af${loginError ? ' err' : ''}`} style={{ marginBottom: 4 }}>
              <label htmlFor="l-pw">Contraseña</label>
              <input className="pw" id="l-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button ref={olvideBtnRef} type="button" className="pp-lnk" style={{ marginBottom: 14 }} onClick={abrirOlvide}>Olvidé mi contraseña</button>
            <button type="submit" className="pp-pb pri full" disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
          </form>
        </div>
      </main>

      <div className={`pp-scrim${sheetOpen ? ' open' : ''}`} onClick={() => setSheetOpen(false)} />
      <section className={`pp-sheet${sheetOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="forgot-t">
        <div className="pp-grab" />
        <div className="pp-so-hdr">
          <div className="pp-tt">
            <h2 id="forgot-t">Recuperar contraseña</h2>
            <div className="pp-sb">Te mandamos un link para crear una nueva.</div>
          </div>
          <button className="pp-so-close" aria-label="Cerrar" onClick={() => setSheetOpen(false)}>{IconX}</button>
        </div>
        <div className="pp-so-body" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
          {sent ? (
            <>
              <div className="pp-sent" role="status">{IconMail}<span>Si <b>{forgotEmail}</b> está registrado, te llega un link en unos minutos. Revisá también la carpeta de spam.</span></div>
              <button className="pp-pb full" style={{ marginTop: 14 }} onClick={() => setSheetOpen(false)}>Volver a ingresar</button>
            </>
          ) : (
            <form onSubmit={enviarRecuperacion}>
              <div className="pp-af">
                <label htmlFor="f-em">Email</label>
                <input id="f-em" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
              </div>
              <button type="submit" className="pp-pb pri full" disabled={sending}>{sending ? 'Enviando...' : 'Enviarme el link'}</button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
