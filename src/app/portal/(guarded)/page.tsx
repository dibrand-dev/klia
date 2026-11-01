import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import HoyClient from '@/components/portal/HoyClient'

export const dynamic = 'force-dynamic'

export default async function PortalHoyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const db = serviceClient()
  // El layout ya redirige a PortalNoDisponible si accesoPrincipal es null —
  // si esta página llegó a renderizar, hay un principal válido.
  const principal = await accesoPrincipal(db, user!.id)

  const [{ data: paciente }, { data: profile }] = await Promise.all([
    db.from('pacientes').select('nombre').eq('id', principal!.pacienteId).maybeSingle(),
    db.from('profiles').select('nombre, apellido').eq('id', principal!.terapeutaId).maybeSingle(),
  ])

  const profesionalNombre = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'tu profesional'

  return <HoyClient pacienteNombre={paciente?.nombre ?? ''} profesionalNombre={profesionalNombre} />
}
