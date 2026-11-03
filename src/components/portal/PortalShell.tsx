'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOffline } from '@/lib/portal/useOffline'
import { PasswordField, PasswordRequirementsList, passwordRequisitos } from './password'
import { ToastProvider, useToast } from './ToastContext'
import './portal.css'

const IconLock = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'var(--muted)', strokeWidth: 1.7, fill: 'none' }}><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
const IconLogout = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'var(--danger)', strokeWidth: 1.7, fill: 'none' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
const IconOffline = <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: '#fff', strokeWidth: 1.9, fill: 'none' }}><path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18" /></svg>
const IconX = <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, stroke: 'var(--ink-2)', strokeWidth: 1.8, fill: 'none' }}><path d="M6 6l12 12M18 6L6 18" /></svg>
const IconAlert = <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>
const IconHoy = <svg viewBox="0 0 24 24"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>
const IconPlan = <svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h5" /></svg>

function iniciales(nombre: string, apellido: string): string {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase()
}

export default function PortalShell(props: {
  profesionalNombre: string
  especialidad: string | null
  pacienteNombre: string
  pacienteApellido: string
  pacienteEmail: string
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <PortalShellInner {...props} />
    </ToastProvider>
  )
}

function PortalShellInner({
  profesionalNombre, especialidad, pacienteNombre, pacienteApellido, pacienteEmail, children,
}: {
  profesionalNombre: string
  especialidad: string | null
  pacienteNombre: string
  pacienteApellido: string
  pacienteEmail: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  const offline = useOffline()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const acctBtnRef = useRef<HTMLButtonElement>(null)
  const cambiarPwBtnRef = useRef<HTMLButtonElement>(null)

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  useEffect(() => {
    if (!sheetOpen && !menuOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (sheetOpen) {
        setSheetOpen(false)
        cambiarPwBtnRef.current?.focus()
      } else if (menuOpen) {
        setMenuOpen(false)
        acctBtnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sheetOpen, menuOpen])

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/portal/login')
  }

  function abrirCambiarContrasena() {
    setMenuOpen(false)
    setActual(''); setNueva(''); setConfirmar(''); setPwError(null)
    setSheetOpen(true)
  }

  async function guardarContrasena() {
    setPwError(null)
    if (!actual) { setPwError('Ingresá tu contraseña actual.'); return }
    if (!passwordRequisitos(nueva, confirmar).every((r) => r.ok)) return

    setPwLoading(true)
    const res = await fetch('/api/portal/cambiar-contrasena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual, nueva }),
    })
    const body = await res.json().catch(() => null)
    setPwLoading(false)

    if (!res.ok) {
      setPwError(body?.message ?? 'No pudimos actualizar tu contraseña.')
      return
    }

    setSheetOpen(false)
    toast('Contraseña actualizada')
  }

  const puedeGuardarContrasena = !!actual && passwordRequisitos(nueva, confirmar).every((r) => r.ok)

  return (
    <div className={`pp-shell${offline ? ' offline' : ''}`} id="pp">
      <div className="pp-net" role="status">{IconOffline}<span>Sin conexión. Vas a poder registrar cuando vuelva la señal.</span></div>

      <header className="pp-hd">
        <div className="pp-pro">
          <b>{profesionalNombre}</b>
          <span>{especialidad ? `${especialidad} · Portal del paciente` : 'Portal del paciente'}</span>
        </div>
        {/* sin position propio — el .menu se posiciona absoluto contra .pp-hd (position:relative), igual que en el diseño */}
        <div ref={menuRef}>
          <button
            ref={acctBtnRef}
            className="pp-acct" aria-label="Menú de cuenta" aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="pp-av">{iniciales(pacienteNombre, pacienteApellido)}</span>
          </button>
          <div className={`pp-menu${menuOpen ? ' open' : ''}`} role="menu">
            <div className="pp-who"><b>{pacienteNombre} {pacienteApellido}</b><span>{pacienteEmail}</span></div>
            <button ref={cambiarPwBtnRef} className="pp-mi" role="menuitem" onClick={abrirCambiarContrasena}>{IconLock}Cambiar contraseña</button>
            <button className="pp-mi danger" role="menuitem" onClick={cerrarSesion}>{IconLogout}Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="pp-main">{children}</main>

      <nav className="pp-tabbar" aria-label="Secciones">
        <Link href="/portal" className={`pp-tb${pathname === '/portal' ? ' on' : ''}`} aria-current={pathname === '/portal' ? 'page' : undefined}>
          {IconHoy}Hoy
        </Link>
        <Link href="/portal/plan" className={`pp-tb${pathname === '/portal/plan' ? ' on' : ''}`} aria-current={pathname === '/portal/plan' ? 'page' : undefined}>
          {IconPlan}Mi plan
        </Link>
      </nav>

      <div className={`pp-scrim${sheetOpen ? ' open' : ''}`} onClick={() => setSheetOpen(false)} />
      <section className={`pp-sheet${sheetOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="pw-t">
        <div className="pp-grab" />
        <div className="pp-so-hdr">
          <div className="pp-tt"><h2 id="pw-t">Cambiar contraseña</h2></div>
          <button className="pp-so-close" aria-label="Cerrar" onClick={() => setSheetOpen(false)}>{IconX}</button>
        </div>
        <div className="pp-so-body">
          {pwError && <div className="pp-note danger" role="alert" style={{ marginTop: 0, marginBottom: 16 }}>{IconAlert}<span>{pwError}</span></div>}
          <PasswordField id="pw-actual" label="Contraseña actual" autoComplete="current-password" value={actual} onChange={setActual} />
          <PasswordField id="pw-nueva" label="Nueva contraseña" autoComplete="new-password" value={nueva} onChange={setNueva} />
          <PasswordField id="pw-confirmar" label="Confirmar nueva contraseña" autoComplete="new-password" value={confirmar} onChange={setConfirmar} />
          <PasswordRequirementsList a={nueva} b={confirmar} />
        </div>
        <div className="pp-so-foot">
          <button className="pp-pb" onClick={() => setSheetOpen(false)}>Cancelar</button>
          <button className="pp-pb pri" disabled={!puedeGuardarContrasena || pwLoading} onClick={guardarContrasena}>
            {pwLoading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </section>
    </div>
  )
}
