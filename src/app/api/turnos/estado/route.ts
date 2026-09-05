import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const runtime = 'nodejs'

const ESTADOS_VALIDOS = ['pendiente', 'confirmado', 'realizado', 'no_asistio', 'cancelado', 'programado']

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { turno_id, estado, motivo_cancelacion } = await req.json() as { turno_id: string; estado: string; motivo_cancelacion?: string | null }

  if (!turno_id || !estado) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const { data: turno, error: fetchError } = await supabase
    .from('turnos')
    .select('id, terapeuta_id')
    .eq('id', turno_id)
    .single()

  if (fetchError || !turno) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  if (turno.terapeuta_id !== efectivo.terapeutaId) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // Sincroniza con el campo operativo `estado_atencion` cuando corresponde —
  // 'programado'/'cancelado' no tienen equivalente operativo, se dejan igual.
  // 'pendiente'/'confirmado' sí resetean estado_atencion: son una corrección
  // explícita de error, así que a diferencia de 'cancelado' no llevan guarda.
  const update: { estado: string; estado_atencion?: string | null; motivo_cancelacion?: string | null } = { estado }
  if (estado === 'realizado') update.estado_atencion = 'atendido'
  if (estado === 'no_asistio') update.estado_atencion = 'ausente'
  if (estado === 'pendiente' || estado === 'confirmado') update.estado_atencion = null
  if (estado === 'cancelado' && motivo_cancelacion !== undefined) update.motivo_cancelacion = motivo_cancelacion

  const { data: updated, error: updateError } = await supabase
    .from('turnos')
    .update(update)
    .eq('id', turno_id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, turno: updated })
}
