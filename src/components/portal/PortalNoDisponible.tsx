'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './portal.css'

const IconLock = <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: 'var(--accent-ink)', strokeWidth: 1.7, fill: 'none' }}><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>

// Sin header ni tabbar — mismo criterio que el diseño (vUnavail): no hay
// nada que listar ni ningún acceso que mostrar.
export default function PortalNoDisponible() {
  const router = useRouter()

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/portal/login')
  }

  return (
    <div className="pp-shell">
      <main className="pp-main">
        <div className="pp-empty" style={{ marginTop: 40 }}>
          <div className="pp-ic">{IconLock}</div>
          <h3>Portal no disponible</h3>
          <p>Tu profesional ya no tiene habilitado el portal.</p>
          <button className="pp-pb pri full" style={{ marginTop: 20 }} onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </main>
    </div>
  )
}
