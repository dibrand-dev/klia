import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { paciente_id, monto_recibido, medio_pago } = await req.json() as {
    paciente_id: string
    monto_recibido: number
    medio_pago: 'efectivo' | 'transferencia' | 'mercado_pago'
  }

  if (!paciente_id || !monto_recibido || !medio_pago) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const { data: turnos } = await supabase
    .from('turnos')
    .select('id, fecha_hora, monto, monto_pagado, moneda, estado_pago')
    .eq('paciente_id', paciente_id)
    .eq('terapeuta_id', user.id)
    .in('estado_pago', ['pendiente', 'pago_parcial'])
    .in('estado', ['realizado', 'no_asistio'])
    .order('fecha_hora', { ascending: true })

  if (!turnos?.length) {
    return NextResponse.json({ error: 'No hay sesiones pendientes de cobro' }, { status: 400 })
  }

  let restante = monto_recibido
  const fechaCobro = new Date().toISOString().slice(0, 10)
  const monedaPago = turnos[0]?.moneda || 'ARS'
  const turnosUpdates: { id: string; monto_pagado: number; estado_pago: string; pagado: boolean }[] = []
  let primerTurnoId: string | null = null
  let sesiones_saldadas = 0
  let sesion_parcial: { turno_id: string; monto_aplicado: number; saldo_restante: number } | null = null

  for (const turno of turnos) {
    if (restante <= 0) break
    const saldo = (turno.monto ?? 0) - (turno.monto_pagado ?? 0)
    if (saldo <= 0) continue

    if (primerTurnoId === null) primerTurnoId = turno.id

    if (restante >= saldo) {
      restante -= saldo
      sesiones_saldadas++
      turnosUpdates.push({ id: turno.id, monto_pagado: turno.monto ?? 0, estado_pago: 'pagado', pagado: true })
    } else {
      sesion_parcial = { turno_id: turno.id, monto_aplicado: restante, saldo_restante: saldo - restante }
      turnosUpdates.push({ id: turno.id, monto_pagado: (turno.monto_pagado ?? 0) + restante, estado_pago: 'pago_parcial', pagado: false })
      restante = 0
    }
  }

  if (!primerTurnoId || turnosUpdates.length === 0) {
    return NextResponse.json({ error: 'No hay sesiones que actualizar' }, { status: 400 })
  }

  const { error: cobroError } = await supabase.from('cobros').insert({
    turno_id: primerTurnoId,
    terapeuta_id: user.id,
    paciente_id,
    monto_cobrado: monto_recibido,
    moneda: monedaPago,
    medio_pago,
    fecha_cobro: fechaCobro,
  })

  if (cobroError) return NextResponse.json({ error: cobroError.message }, { status: 500 })

  for (const { id, ...fields } of turnosUpdates) {
    await supabase.from('turnos').update(fields).eq('id', id)
  }

  return NextResponse.json({ ok: true, sesiones_saldadas, sesion_parcial, monto_restante: restante })
}
