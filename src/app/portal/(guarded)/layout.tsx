import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import PortalShell from '@/components/portal/PortalShell'
import PortalNoDisponible from '@/components/portal/PortalNoDisponible'

export const dynamic = 'force-dynamic'

// Guard de /portal (grupo de ruta, no afecta a /portal/login ni /portal/activar
// que quedan como hermanos fuera de este grupo porque son el punto de entrada
// para quien todavía no tiene sesión o todavía no activó su cuenta).
//
// Nunca se autoriza por user_metadata (editable por el propio usuario desde el
// cliente con auth.updateUser()) — solo por app_metadata (solo el server la
// escribe, con service_role) y por el estado real de paciente_accesos en la base.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')
  if (user.app_metadata?.tipo_cuenta !== 'paciente') redirect('/')

  const db = serviceClient()

  // Tiene que existir al menos un acceso 'activo' para no mandar a alguien
  // que ya activó su cuenta de vuelta a /portal/login como si nunca hubiera
  // activado nada.
  const { data: accesos } = await db
    .from('paciente_accesos')
    .select('paciente_id')
    .eq('auth_user_id', user.id)
    .eq('estado', 'activo')
    .limit(1)

  if (!accesos || accesos.length === 0) redirect('/portal/login')

  // El diseño asume un único profesional — accesoPrincipal ya filtra por
  // puedeUsarPortal y devuelve el más reciente entre los habilitados (o
  // null si ninguno lo está AHORA, aunque el acceso siga 'activo').
  const principal = await accesoPrincipal(db, user.id)

  if (!principal) {
    return <PortalNoDisponible />
  }

  const [{ data: paciente }, { data: profile }] = await Promise.all([
    db.from('pacientes').select('nombre, apellido').eq('id', principal.pacienteId).maybeSingle(),
    db.from('profiles').select('nombre, apellido, especialidad').eq('id', principal.terapeutaId).maybeSingle(),
  ])

  const profesionalNombre = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'Tu profesional'

  return (
    <PortalShell
      profesionalNombre={profesionalNombre}
      especialidad={profile?.especialidad ?? null}
      pacienteNombre={paciente?.nombre ?? ''}
      pacienteApellido={paciente?.apellido ?? ''}
      pacienteEmail={user.email ?? ''}
    >
      {children}
    </PortalShell>
  )
}
