import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ESTADOS_VALIDOS = ['realizado', 'no_asistio', 'cancelado', 'programado']

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { turno_id, estado } = await req.json() as { turno_id: string; estado: string }

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

  if (turno.terapeuta_id !== user.id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('turnos')
    .update({ estado })
    .eq('id', turno_id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, turno: updated })
}
