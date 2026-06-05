import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { cobro_id } = await req.json() as { cobro_id: string }
  if (!cobro_id) return NextResponse.json({ error: 'Falta cobro_id' }, { status: 400 })

  const { data: cobro } = await supabase
    .from('cobros')
    .select('id, turno_id, terapeuta_id')
    .eq('id', cobro_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (!cobro) return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 })

  const { data: turno } = await supabase
    .from('turnos')
    .select('id, monto')
    .eq('id', cobro.turno_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })

  const { error: deleteError } = await supabase
    .from('cobros')
    .delete()
    .eq('id', cobro_id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  const { data: remaining } = await supabase
    .from('cobros')
    .select('monto_cobrado')
    .eq('turno_id', cobro.turno_id)

  const nuevoMontoPagado = (remaining ?? []).reduce((sum, c) => sum + (c.monto_cobrado ?? 0), 0)

  let nuevoEstado: string
  let nuevoPagado: boolean
  if (nuevoMontoPagado <= 0) {
    nuevoEstado = 'pendiente'
    nuevoPagado = false
  } else if (nuevoMontoPagado >= (turno.monto ?? 0)) {
    nuevoEstado = 'pagado'
    nuevoPagado = true
  } else {
    nuevoEstado = 'pago_parcial'
    nuevoPagado = false
  }

  const { error: updateError } = await supabase
    .from('turnos')
    .update({
      monto_pagado: nuevoMontoPagado,
      estado_pago: nuevoEstado,
      pagado: nuevoPagado,
    })
    .eq('id', cobro.turno_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
