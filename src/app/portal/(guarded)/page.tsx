import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import PortalLogoutButton from './PortalLogoutButton'

export const dynamic = 'force-dynamic'

// TEMPORAL — texto plano, sin diseño. Placeholder para probar el guard
// (invitación → activación → gating por plan) de punta a punta antes de
// construir la UI real (registro de fotos, Fase 2+).
export default async function PortalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = serviceClient()
  const { data: accesos } = await db
    .from('paciente_accesos')
    .select('paciente_id, pacientes(nombre, apellido)')
    .eq('auth_user_id', user!.id)
    .eq('estado', 'activo')

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>Portal del paciente (temporal)</h1>
      <p>Sesión: {user?.email}</p>
      <p>Accesos activos:</p>
      <ul>
        {(accesos ?? []).map((a) => {
          const paciente = a.pacientes as unknown as { nombre: string; apellido: string } | null
          return (
            <li key={a.paciente_id}>
              {paciente ? `${paciente.nombre} ${paciente.apellido}` : a.paciente_id}
            </li>
          )
        })}
      </ul>
      <PortalLogoutButton />
    </div>
  )
}
