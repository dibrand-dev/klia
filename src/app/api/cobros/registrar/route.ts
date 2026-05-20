import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { turno_id, monto_cobrado, medio_pago, fecha_cobro, notas } = await req.json() as {
    turno_id: string
    monto_cobrado: number
    medio_pago: 'efectivo' | 'transferencia' | 'mercado_pago'
    fecha_cobro?: string
    notas?: string
  }

  if (!turno_id || !monto_cobrado || !medio_pago) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  // Get the turno (verify ownership)
  const { data: turno, error: turnoError } = await supabase
    .from('turnos')
    .select('id, monto, monto_pagado, estado_pago, paciente_id, terapeuta_id, moneda')
    .eq('id', turno_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (turnoError || !turno) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  const moneda = turno.moneda ?? 'ARS'
  const fechaCobroFinal = fecha_cobro ?? new Date().toISOString().slice(0, 10)

  // Insert cobro
  const { error: cobroError } = await supabase
    .from('cobros')
    .insert({
      turno_id,
      terapeuta_id: user.id,
      paciente_id: turno.paciente_id,
      monto_cobrado,
      moneda,
      medio_pago,
      fecha_cobro: fechaCobroFinal,
      notas: notas ?? null,
    })

  if (cobroError) {
    return NextResponse.json({ error: cobroError.message }, { status: 500 })
  }

  // Update turno
  const prevPagado = turno.monto_pagado ?? 0
  const newMontoPagado = prevPagado + monto_cobrado
  const montoTotal = turno.monto ?? 0
  const newEstado = newMontoPagado >= montoTotal ? 'pagado' : 'pago_parcial'

  const { error: updateError } = await supabase
    .from('turnos')
    .update({
      monto_pagado: newMontoPagado,
      estado_pago: newEstado,
      pagado: newEstado === 'pagado',
    })
    .eq('id', turno_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, estado_pago: newEstado })
}
