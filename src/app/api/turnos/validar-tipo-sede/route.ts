import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { validarTipoSede } from '@/lib/booking/resolver-tipo'

export const runtime = 'nodejs'

// Validación server-side de tipo_turno_id↔sucursal_id al crear turnos desde
// la Agenda interna (single y serie) — mismo criterio de negocio que
// resolver-tipo.ts (reserva pública), vía validarTipoSede. A diferencia del
// booking público, acá no se exige visible_en_booking=true: un tipo
// "solo en agenda" es igual de válido.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { tipo_turno_id: tipoTurnoId, sucursal_id: sucursalId } = await req.json() as {
    tipo_turno_id?: string | null
    sucursal_id?: string | null
  }

  // Tipos base (sin tipo_turno_id) nunca se filtran por sede.
  if (!tipoTurnoId) return NextResponse.json({ ok: true })

  const { data: tipoTurno } = await supabase
    .from('tipos_turno')
    .select('id')
    .eq('id', tipoTurnoId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .eq('activo', true)
    .maybeSingle()

  if (!tipoTurno) return NextResponse.json({ ok: false, error: 'tipo_invalido' }, { status: 400 })

  const ok = await validarTipoSede(supabase, efectivo.terapeutaId, tipoTurnoId, sucursalId ?? null)
  if (!ok) return NextResponse.json({ ok: false, error: 'tipo_invalido' }, { status: 400 })

  return NextResponse.json({ ok: true })
}
