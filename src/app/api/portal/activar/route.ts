import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { puedeUsarPortal } from '@/lib/portal/acceso'

export const runtime = 'nodejs'

// La contraseña ya se setea del lado del cliente con supabase.auth.updateUser()
// antes de llamar acá (mismo patrón que /api/colaboradores/activar). Esto solo
// marca el/los acceso(s) como activos. Un mismo email puede tener más de un
// paciente_accesos 'invitado' (la misma persona, paciente de más de un
// profesional) — activar la cuenta acepta todas las invitaciones pendientes
// de una, salvo que el portal ya no esté habilitado para ese profesional en
// particular (plan/estado de cuenta cambiaron entre la invitación y la
// activación), en cuyo caso esa fila puntual queda 'invitado'.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = serviceClient()

  const { data: accesos, error: fetchError } = await db
    .from('paciente_accesos')
    .select('paciente_id, terapeuta_id')
    .eq('auth_user_id', user.id)
    .eq('estado', 'invitado')

  if (fetchError) {
    console.error('[portal/activar] Error leyendo accesos:', fetchError)
    return NextResponse.json({ error: 'Error al activar la cuenta' }, { status: 500 })
  }
  if (!accesos || accesos.length === 0) {
    return NextResponse.json({ error: 'sin_invitacion', message: 'No encontramos una invitación pendiente para esta cuenta.' }, { status: 404 })
  }

  const idsActivables: string[] = []
  for (const acceso of accesos) {
    if (await puedeUsarPortal(db, acceso.terapeuta_id)) idsActivables.push(acceso.paciente_id)
  }

  if (idsActivables.length === 0) {
    return NextResponse.json(
      { error: 'portal_no_habilitado', message: 'El portal no está disponible para tu profesional en este momento.' },
      { status: 403 },
    )
  }

  const ahora = new Date().toISOString()
  const { error: updateError } = await db
    .from('paciente_accesos')
    .update({ estado: 'activo', activado_at: ahora, consentimiento_at: ahora, auth_user_id: user.id })
    .in('paciente_id', idsActivables)
    .eq('auth_user_id', user.id)

  if (updateError) {
    console.error('[portal/activar] Error activando:', updateError)
    return NextResponse.json({ error: 'Error al activar la cuenta' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
