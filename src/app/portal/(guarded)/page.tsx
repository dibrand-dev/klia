import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesosHabilitados } from '@/lib/portal/acceso'
import PortalLogoutButton from './PortalLogoutButton'

export const dynamic = 'force-dynamic'

// TEMPORAL — texto plano, sin diseño. Placeholder para probar el guard
// (invitación → activación → gating por plan) de punta a punta antes de
// construir la UI real (registro de fotos, Fase 2+).
export default async function PortalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = serviceClient()
  // El layout ya garantiza al menos un acceso habilitado para llegar acá —
  // igual se vuelve a filtrar por puedeUsarPortal acá, nunca se listan
  // accesos 'activo' sin ese filtro (mismo motivo que el fix del layout).
  const habilitados = await accesosHabilitados(db, user!.id)

  let pacientes: { id: string; nombre: string; apellido: string }[] = []
  if (habilitados.length > 0) {
    const { data } = await db
      .from('pacientes')
      .select('id, nombre, apellido')
      .in('id', habilitados.map((a) => a.pacienteId))
    pacientes = data ?? []
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Portal del paciente (temporal)</h1>
      <p>Sesión: {user?.email}</p>
      <p>Accesos activos:</p>
      <ul>
        {pacientes.map((p) => (
          <li key={p.id}>{p.nombre} {p.apellido}</li>
        ))}
      </ul>
      <PortalLogoutButton />
    </div>
  )
}
