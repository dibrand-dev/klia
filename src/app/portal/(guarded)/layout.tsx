import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

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
  const { data: accesos } = await db
    .from('paciente_accesos')
    .select('paciente_id')
    .eq('auth_user_id', user.id)
    .eq('estado', 'activo')
    .limit(1)

  if (!accesos || accesos.length === 0) redirect('/portal/login')

  return <>{children}</>
}
