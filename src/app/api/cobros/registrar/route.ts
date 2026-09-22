import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

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
    .select('id, fecha_hora, monto, monto_pagado, estado_pago, paciente_id, terapeuta_id, moneda')
    .eq('id', turno_id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .single()

  if (turnoError || !turno) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  const moneda = turno.moneda ?? 'ARS'
  const fechaCobroFinal = fecha_cobro ?? new Date().toISOString().slice(0, 10)

  const saldoTurnoActual = (turno.monto ?? 0) - (turno.monto_pagado ?? 0)

  // Sesiones a las que aplicar el cobro: primero la sesión sobre la que se tocó
  // "Cobrar", y si el monto ingresado la excede, se sigue con las siguientes
  // sesiones pendientes de la misma paciente (más antiguas primero — mismo
  // criterio que /api/cobros/pago-a-cuenta), para no dejar el excedente pegado
  // a una sola sesión.
  type TurnoAAplicar = { id: string; monto: number; monto_pagado: number }
  const turnosAAplicar: TurnoAAplicar[] = [
    { id: turno.id, monto: turno.monto ?? 0, monto_pagado: turno.monto_pagado ?? 0 },
  ]

  if (monto_cobrado > saldoTurnoActual) {
    const { data: otrosTurnos } = await supabase
      .from('turnos')
      .select('id, monto, monto_pagado')
      .eq('paciente_id', turno.paciente_id)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .neq('id', turno.id)
      .in('estado_pago', ['pendiente', 'pago_parcial'])
      .in('estado', ['realizado', 'no_asistio'])
      .order('fecha_hora', { ascending: true })

    for (const t of otrosTurnos ?? []) {
      turnosAAplicar.push({ id: t.id, monto: t.monto ?? 0, monto_pagado: t.monto_pagado ?? 0 })
    }
  }

  let restante = monto_cobrado
  const cobrosBatch: object[] = []
  const turnosUpdates: { id: string; monto_pagado: number; estado_pago: string; pagado: boolean }[] = []
  let estadoPagoTurnoPrincipal: string = turno.estado_pago

  for (let i = 0; i < turnosAAplicar.length; i++) {
    const t = turnosAAplicar[i]
    if (restante <= 0) break
    const saldo = t.monto - t.monto_pagado
    if (saldo <= 0) continue

    const montoAplicado = Math.min(restante, saldo)
    restante -= montoAplicado

    const newMontoPagado = t.monto_pagado + montoAplicado
    const newEstado = newMontoPagado >= t.monto ? 'pagado' : 'pago_parcial'

    cobrosBatch.push({
      turno_id: t.id,
      terapeuta_id: efectivo.terapeutaId,
      paciente_id: turno.paciente_id,
      monto_cobrado: montoAplicado,
      moneda,
      medio_pago,
      fecha_cobro: fechaCobroFinal,
      notas: i === 0 ? (notas ?? null) : null,
    })
    turnosUpdates.push({ id: t.id, monto_pagado: newMontoPagado, estado_pago: newEstado, pagado: newEstado === 'pagado' })

    if (t.id === turno.id) estadoPagoTurnoPrincipal = newEstado
  }

  const { error: cobroError } = await supabase.from('cobros').insert(cobrosBatch)
  if (cobroError) {
    return NextResponse.json({ error: cobroError.message }, { status: 500 })
  }

  for (const { id, ...fields } of turnosUpdates) {
    const { error: updateError } = await supabase.from('turnos').update(fields).eq('id', id)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    estado_pago: estadoPagoTurnoPrincipal,
    sesiones_actualizadas: turnosUpdates.length,
    monto_restante: restante,
  })
}
