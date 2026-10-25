import { NextRequest, NextResponse } from 'next/server'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { finalizarReservaConfirmada } from '@/lib/booking/finalizar-reserva'
import { crearOReusarPacienteDesdeReserva } from '@/lib/booking/crear-reserva-desde-pago'
import { ARGENTINA_TZ } from '@/lib/timezone'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json() as { hash?: string }
  const { hash } = body

  if (!hash) {
    return NextResponse.json({ error: 'hash requerido' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: reserva } = await db
    .from('reservas_pendientes_pago')
    .select('*')
    .eq('hash', hash)
    .maybeSingle()

  if (!reserva) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }

  if (reserva.estado === 'procesada' && reserva.turno_id) {
    // Ya confirmada (doble click) — idempotente: se devuelve el turno ya creado.
    const { data: turno } = await db
      .from('turnos')
      .select('fecha_hora, duracion_min, google_event_id, meet_link')
      .eq('id', reserva.turno_id)
      .maybeSingle()
    const fechaLocal = turno ? toZonedTime(parseISO(turno.fecha_hora), ARGENTINA_TZ) : null
    return NextResponse.json({
      turno_id: reserva.turno_id,
      mp_payment_id: null,
      fecha_fmt: fechaLocal ? format(fechaLocal, "EEEE d 'de' MMMM yyyy", { locale: es }) : '',
      hora: fechaLocal ? format(fechaLocal, 'HH:mm') : '',
      duracion: turno?.duracion_min ?? 0,
      monto: reserva.monto ?? 0,
      moneda: reserva.moneda,
      referencia: hash,
      medio_pago: 'transferencia' as const,
      google_event_id: turno?.google_event_id ?? null,
      meet_link: turno?.meet_link ?? null,
    })
  }

  if (reserva.estado !== 'pendiente') {
    return NextResponse.json({ error: 'La reserva ya no está disponible' }, { status: 409 })
  }

  // El turno (y el paciente) se crean recién al elegir transferencia — mismo
  // comportamiento que siempre tuvo este medio (queda 'pendiente', espera
  // confirmación manual del profesional en Agenda), solo que ahora arrancan
  // desde la reserva en vez de ya existir desde booking/crear.
  const pacienteId = await crearOReusarPacienteDesdeReserva(db, reserva)
  if (!pacienteId) {
    return NextResponse.json({ error: 'Error al registrar paciente' }, { status: 500 })
  }

  const tipoTurnoColumn = reserva.tipo_turno_id ? 'sesion' : (reserva.tipo_turno === 'sesion' ? 'sesion' : 'entrevista')

  const { data: turno, error: turnoErr } = await db
    .from('turnos')
    .insert({
      terapeuta_id: reserva.terapeuta_id,
      paciente_id: pacienteId,
      fecha_hora: reserva.fecha_hora,
      duracion_min: reserva.duracion_min,
      modalidad: reserva.modalidad,
      estado: 'pendiente' as const,
      monto: reserva.monto,
      moneda: reserva.moneda,
      sucursal_id: reserva.sucursal_id,
      notas: (!reserva.tipo_turno_id && reserva.tipo_turno === 'entrevista') ? 'Entrevista inicial reservada online' : 'Reserva online',
      tipo_turno: tipoTurnoColumn,
      tipo_turno_id: reserva.tipo_turno_id,
    })
    .select('id')
    .single()

  if (turnoErr || !turno) {
    console.error('[booking/confirmar-transferencia] turno insert error:', turnoErr)
    return NextResponse.json({ error: 'Error al crear turno' }, { status: 500 })
  }

  // vence_en: nunca más de 24hs, y nunca después de la hora de la cita — si el turno
  // es en menos de 24hs, no tiene sentido dar una ventana de comprobante más larga que
  // la cita misma. El cron de vencer-turnos-transferencia cancela automáticamente los
  // turnos 'pendiente' que superen este timestamp sin haber sido confirmados a mano.
  const veinticuatroHs = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const fechaCita = parseISO(reserva.fecha_hora)
  const venceEn = (fechaCita < veinticuatroHs ? fechaCita : veinticuatroHs).toISOString()

  await db.from('turnos').update({ vence_en: venceEn }).eq('id', turno.id)
  await db.from('reservas_pendientes_pago').update({ turno_id: turno.id }).eq('hash', hash)

  const { googleEventId, meetLink } = await finalizarReservaConfirmada(turno.id, reserva.terapeuta_id, 'transferencia', {
    monto: reserva.monto ?? 0,
    moneda: reserva.moneda ?? 'ARS',
    referencia: hash,
  })

  const fechaLocal = toZonedTime(parseISO(reserva.fecha_hora), ARGENTINA_TZ)

  return NextResponse.json({
    turno_id: turno.id,
    mp_payment_id: null,
    fecha_fmt: format(fechaLocal, "EEEE d 'de' MMMM yyyy", { locale: es }),
    hora: format(fechaLocal, 'HH:mm'),
    duracion: reserva.duracion_min,
    monto: reserva.monto ?? 0,
    moneda: reserva.moneda,
    referencia: hash,
    medio_pago: 'transferencia' as const,
    google_event_id: googleEventId,
    meet_link: meetLink,
  })
}
