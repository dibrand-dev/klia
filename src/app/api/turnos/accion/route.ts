import { NextRequest, NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/brevo'
import { emailTurnoCanceladoPorPaciente } from '@/lib/email-templates'
import { evaluarCancelacion } from '@/lib/politica-cancelacion'
import { sincronizarTurnoCreado, sincronizarTurnoCancelado } from '@/lib/sync-google-calendar'
import { formatFechaHoraAR } from '@/lib/tz'
import { turnoEstaPagado, montoPagadoTurno } from '@/lib/turno-pago'
import { serviceClient } from '@/lib/supabase/service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADOS_CERRADOS = ['realizado', 'no_asistio']

export async function POST(req: NextRequest) {
  const body = await req.json() as { token?: string; accion?: string }
  const { token, accion } = body

  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: 'token_invalido' }, { status: 400 })
  }
  if (accion !== 'confirmar' && accion !== 'cancelar') {
    return NextResponse.json({ error: 'accion_invalida' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: turno } = await db
    .from('turnos')
    .select(`
      id, terapeuta_id, estado, fecha_hora, google_event_id, pagado, estado_pago, monto_pagado, monto, moneda, cancelacion_tardia,
      paciente:pacientes(nombre, apellido),
      terapeuta:profiles(nombre, apellido, email, cobros_cancelacion_horas)
    `)
    .eq('token_accion', token)
    .maybeSingle()

  if (!turno) {
    return NextResponse.json({ error: 'token_invalido' }, { status: 404 })
  }

  const paciente = turno.paciente as unknown as { nombre: string; apellido: string } | null
  const terapeuta = turno.terapeuta as unknown as { nombre: string; apellido: string; email: string | null; cobros_cancelacion_horas: number | null } | null
  const yaPaso = new Date(turno.fecha_hora) < new Date()

  if (accion === 'confirmar') {
    if (turno.estado === 'confirmado') {
      return NextResponse.json({ ok: true, estado: 'confirmado', pagado: turnoEstaPagado(turno), tardia: false })
    }
    if (turno.estado === 'cancelado') {
      // 409 pero con estado — el client refresca su UI con esto en vez de
      // quedarse en un error genérico.
      return NextResponse.json({ error: 'turno_cancelado', estado: 'cancelado', pagado: turnoEstaPagado(turno), tardia: turno.cancelacion_tardia ?? false }, { status: 409 })
    }
    if (ESTADOS_CERRADOS.includes(turno.estado) || yaPaso) {
      return NextResponse.json({ error: 'turno_no_disponible', estado: turno.estado, pagado: turnoEstaPagado(turno), tardia: false }, { status: 409 })
    }

    const { data: actualizados, error: updateErr } = await db
      .from('turnos')
      .update({ estado: 'confirmado', confirmado_por_paciente_at: new Date().toISOString() })
      .eq('token_accion', token)
      .eq('estado', 'pendiente')
      .select('id')

    if (updateErr) {
      console.error('[turnos/accion] Error al confirmar turno:', updateErr)
      return NextResponse.json({ error: 'error_interno' }, { status: 500 })
    }

    if (!actualizados || actualizados.length === 0) {
      // Carrera: cambió de estado entre la lectura y el update — se relee
      // para responder con el estado real en vez de asumir éxito.
      const { data: actual } = await db.from('turnos').select('estado, pagado, estado_pago, monto_pagado, monto').eq('token_accion', token).single()
      return NextResponse.json({ ok: true, estado: actual?.estado ?? turno.estado, pagado: actual ? turnoEstaPagado(actual) : turnoEstaPagado(turno), tardia: false })
    }

    if (!turno.google_event_id) {
      try {
        await sincronizarTurnoCreado(turno.id, turno.terapeuta_id)
      } catch (e) {
        console.error('[turnos/accion] Error sincronizando Google Calendar (confirmar):', e)
      }
    }

    return NextResponse.json({ ok: true, estado: 'confirmado', pagado: turnoEstaPagado(turno), tardia: false })
  }

  // accion === 'cancelar'
  if (turno.estado === 'cancelado') {
    return NextResponse.json({ ok: true, estado: 'cancelado', pagado: turnoEstaPagado(turno), tardia: turno.cancelacion_tardia ?? false })
  }
  if (ESTADOS_CERRADOS.includes(turno.estado) || yaPaso) {
    return NextResponse.json({ error: 'turno_no_disponible', estado: turno.estado, pagado: turnoEstaPagado(turno), tardia: false }, { status: 409 })
  }

  const { horasAnticipacion, politicaHoras, tardia } = evaluarCancelacion(turno.fecha_hora, terapeuta?.cobros_cancelacion_horas)

  // No se toca estado_pago/pagado/monto_pagado: un turno pagado se puede
  // cancelar, pero el pago queda registrado y nunca se pierde.
  const { data: cancelados, error: cancelErr } = await db
    .from('turnos')
    .update({
      estado: 'cancelado',
      cancelado_por: 'paciente',
      cancelado_at: new Date().toISOString(),
      cancelacion_tardia: tardia,
      motivo_cancelacion: 'Cancelado por el paciente desde el recordatorio',
    })
    .eq('token_accion', token)
    .in('estado', ['pendiente', 'confirmado'])
    .select('id')

  if (cancelErr) {
    console.error('[turnos/accion] Error al cancelar turno:', cancelErr)
    return NextResponse.json({ error: 'error_interno' }, { status: 500 })
  }

  if (!cancelados || cancelados.length === 0) {
    // Carrera: ya no estaba pendiente/confirmado al momento del update.
    const { data: actual } = await db.from('turnos').select('estado, pagado, estado_pago, monto_pagado, monto, cancelacion_tardia').eq('token_accion', token).single()
    return NextResponse.json({ ok: true, estado: actual?.estado ?? turno.estado, pagado: actual ? turnoEstaPagado(actual) : turnoEstaPagado(turno), tardia: actual?.cancelacion_tardia ?? false })
  }

  // Afectó 1 fila — todo lo que sigue va con await antes de responder (serverless).
  const { error: sesionPagoErr } = await db
    .from('sesiones_pago')
    .update({ estado: 'cancelado', updated_at: new Date().toISOString() })
    .eq('turno_id', turno.id)
    .eq('estado', 'pendiente')
  if (sesionPagoErr) console.error('[turnos/accion] Error al cancelar sesion_pago asociada:', sesionPagoErr)

  try {
    await sincronizarTurnoCancelado(turno.id, turno.terapeuta_id)
  } catch (e) {
    console.error('[turnos/accion] Error sincronizando Google Calendar (cancelar):', e)
  }

  const pagado = turnoEstaPagado(turno)

  if (terapeuta?.email) {
    try {
      const { fecha: fechaFmt, hora: horaFmt } = formatFechaHoraAR(turno.fecha_hora)

      await enviarEmail({
        destinatario: terapeuta.email,
        nombreDestinatario: `${terapeuta.nombre} ${terapeuta.apellido}`,
        asunto: `Turno cancelado por el paciente: ${paciente?.nombre ?? ''} ${paciente?.apellido ?? ''} — ${fechaFmt} ${horaFmt}`,
        htmlContent: emailTurnoCanceladoPorPaciente({
          pacienteNombre: paciente?.nombre ?? '',
          pacienteApellido: paciente?.apellido ?? '',
          fecha: fechaFmt,
          hora: horaFmt,
          pagado,
          montoPagado: pagado ? (montoPagadoTurno(turno) ?? undefined) : undefined,
          moneda: turno.moneda,
          horasAnticipacion,
          politicaHoras,
          tardia,
        }),
      })
    } catch (e) {
      console.error('[turnos/accion] Error al enviar mail de cancelación al profesional:', e)
    }
  }

  return NextResponse.json({ ok: true, estado: 'cancelado', pagado, tardia })
}
