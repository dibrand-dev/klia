import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { puedeUsarPortal } from '@/lib/portal/acceso'
import { diasRetencionPorPlan } from '@/lib/portal/retencion'

export const runtime = 'nodejs'

// Estado para la tarjeta "Portal del paciente" de la solapa Registro.
// Mapeo (decisión del profesional, no inventado): sin fila en
// paciente_accesos o estado 'revocado' -> 'sin_invitar'; 'invitado' ->
// 'invitado'; 'activo' -> 'activo'.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const [{ data: paciente }, { data: profile }, { data: acceso }] = await Promise.all([
    db.from('pacientes').select('email').eq('id', params.id).eq('terapeuta_id', efectivo.terapeutaId).maybeSingle(),
    db.from('profiles').select('plan').eq('id', efectivo.terapeutaId).maybeSingle(),
    db.from('paciente_accesos').select('estado, invitado_at, activado_at, registro_habilitado')
      .eq('paciente_id', params.id).eq('terapeuta_id', efectivo.terapeutaId).maybeSingle(),
  ])

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const habilitado = await puedeUsarPortal(db, efectivo.terapeutaId)
  if (!habilitado) {
    return NextResponse.json({ error: 'portal_no_habilitado', message: 'Tu plan no incluye el portal del paciente.' }, { status: 403 })
  }

  const diasRetencion = await diasRetencionPorPlan(db, profile?.plan ?? null)

  return NextResponse.json({
    estado: !acceso || acceso.estado === 'revocado' ? 'sin_invitar' : acceso.estado,
    email: paciente.email,
    invitadoAt: acceso?.invitado_at ?? null,
    activadoAt: acceso?.activado_at ?? null,
    registroHabilitado: acceso?.registro_habilitado ?? true,
    diasRetencion,
  })
}
