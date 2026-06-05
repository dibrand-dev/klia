import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { paciente_id, mes, anio, monto, moneda, medio_pago } = await req.json() as {
    paciente_id: string
    mes: number
    anio: number
    monto: number
    moneda: string
    medio_pago: 'efectivo' | 'transferencia' | 'mercado_pago'
  }

  if (!paciente_id || !monto || !medio_pago || mes == null || !anio) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const { data: paciente } = await supabase
    .from('pacientes')
    .select('id, cobrar_inasistencias')
    .eq('id', paciente_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('cobrar_inasistencias')
    .eq('id', user.id)
    .single()

  const cobrarInasistencia = paciente.cobrar_inasistencias ?? (profile?.cobrar_inasistencias ?? false)

  const inicioMes = new Date(anio, mes, 1).toISOString()
  const finMes = new Date(anio, mes + 1, 0, 23, 59, 59).toISOString()
  const estadosCobrables = cobrarInasistencia ? ['realizado', 'no_asistio'] : ['realizado']

  const { data: turnos } = await supabase
    .from('turnos')
    .select('id, monto, monto_pagado, estado_pago, pagado')
    .eq('paciente_id', paciente_id)
    .eq('terapeuta_id', user.id)
    .in('estado', estadosCobrables)
    .eq('pagado', false)
    .gte('fecha_hora', inicioMes)
    .lte('fecha_hora', finMes)
    .order('fecha_hora', { ascending: true })

  if (!turnos?.length) {
    return NextResponse.json({ error: 'No hay sesiones pendientes de cobro en este mes' }, { status: 400 })
  }

  let remaining = monto
  const fechaCobro = new Date().toISOString().slice(0, 10)
  const cobrosBatch: object[] = []
  const turnosUpdates: { id: string; monto_pagado: number; estado_pago: string; pagado: boolean }[] = []

  for (const turno of turnos) {
    if (remaining <= 0) break
    const montoPendienteTurno = (turno.monto ?? 0) - (turno.monto_pagado ?? 0)
    if (montoPendienteTurno <= 0) continue

    const montoCobradoEseTurno = Math.min(remaining, montoPendienteTurno)
    remaining -= montoCobradoEseTurno

    const newMontoPagado = (turno.monto_pagado ?? 0) + montoCobradoEseTurno
    const newEstado = newMontoPagado >= (turno.monto ?? 0) ? 'pagado' : 'pago_parcial'

    cobrosBatch.push({
      turno_id: turno.id,
      terapeuta_id: user.id,
      paciente_id,
      monto_cobrado: montoCobradoEseTurno,
      moneda,
      medio_pago,
      fecha_cobro: fechaCobro,
    })

    turnosUpdates.push({
      id: turno.id,
      monto_pagado: newMontoPagado,
      estado_pago: newEstado,
      pagado: newEstado === 'pagado',
    })
  }

  if (cobrosBatch.length === 0) {
    return NextResponse.json({ error: 'No hay sesiones que actualizar' }, { status: 400 })
  }

  const { error: cobroError } = await supabase.from('cobros').insert(cobrosBatch)
  if (cobroError) return NextResponse.json({ error: cobroError.message }, { status: 500 })

  for (const { id, ...fields } of turnosUpdates) {
    await supabase.from('turnos').update(fields).eq('id', id)
  }

  return NextResponse.json({ ok: true, sesionesActualizadas: turnosUpdates.length, montoRestante: remaining })
}
