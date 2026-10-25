import { format } from 'date-fns'
import { finalizarReservaConfirmada, type MedioPago, type DatosPago } from '@/lib/booking/finalizar-reserva'
import { isSlotAvailable } from '@/lib/booking/slot-disponible'
import { normalizarEmail, normalizarNombre, escaparIlike } from '@/lib/pacientes/duplicados'
import { enviarEmail } from '@/lib/brevo'
import { emailSobreturnoReservaPublica } from '@/lib/email-templates'
import { zonedDateArgentina, formatFechaHoraArgentina } from '@/lib/timezone'
import { serviceClient } from '@/lib/supabase/service'

export type ReservaPendientePago = {
  hash: string
  terapeuta_id: string
  nombre: string
  apellido: string
  email: string | null
  telefono: string | null
  whatsapp_opt_in: boolean
  fecha_hora: string
  duracion_min: number
  modalidad: 'presencial' | 'videollamada' | 'telefonica'
  sucursal_id: string | null
  tipo_turno: string | null
  tipo_turno_id: string | null
  moneda: string | null
  monto: number | null
  turno_id: string | null
}

// Compartido entre crearReservaDesdePago y confirmar-transferencia — mismo
// dedupe que booking/crear (paso 3), pero a partir de los datos ya guardados
// en reservas_pendientes_pago en vez de los del body del request original.
// Nunca crea un paciente nuevo si ya existe alguno con este email para este
// profesional.
export async function crearOReusarPacienteDesdeReserva(
  db: ReturnType<typeof serviceClient>,
  reserva: Pick<ReservaPendientePago, 'terapeuta_id' | 'nombre' | 'apellido' | 'email' | 'telefono' | 'whatsapp_opt_in' | 'tipo_turno' | 'tipo_turno_id'>,
): Promise<string | null> {
  const emailNormalizado = normalizarEmail(reserva.email) ?? ''
  const { data: existentes } = await db
    .from('pacientes')
    .select('id, nombre, apellido, activo, created_at')
    .eq('terapeuta_id', reserva.terapeuta_id)
    .ilike('email', escaparIlike(emailNormalizado))

  const ordenados = (existentes ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
  const nombreBuscado = normalizarNombre(reserva.nombre)
  const apellidoBuscado = normalizarNombre(reserva.apellido)
  const activos = ordenados.filter((p) => p.activo)
  const existing =
    activos.find((p) => normalizarNombre(p.nombre) === nombreBuscado && normalizarNombre(p.apellido) === apellidoBuscado)
    ?? activos[0]
    ?? ordenados[0]
    ?? null

  if (existing) {
    const patch: Record<string, unknown> = {}
    if (!existing.activo) patch.activo = true
    if (reserva.whatsapp_opt_in) {
      patch.whatsapp_opt_in = true
      patch.whatsapp_opt_in_at = new Date().toISOString()
      patch.whatsapp_opt_in_origen = 'reserva_publica'
    }
    if (Object.keys(patch).length > 0) {
      await db.from('pacientes').update(patch).eq('id', existing.id)
    }
    return existing.id
  }

  const { data: newPaciente, error: pacErr } = await db
    .from('pacientes')
    .insert({
      terapeuta_id: reserva.terapeuta_id,
      nombre: reserva.nombre,
      apellido: reserva.apellido,
      email: emailNormalizado,
      telefono: reserva.telefono,
      activo: true,
      motivo_consulta: (!reserva.tipo_turno_id && reserva.tipo_turno === 'entrevista') ? 'Entrevista inicial (reserva online)' : null,
      ...(reserva.whatsapp_opt_in ? { whatsapp_opt_in: true, whatsapp_opt_in_at: new Date().toISOString(), whatsapp_opt_in_origen: 'reserva_publica' } : {}),
    })
    .select('id')
    .single()

  if (pacErr || !newPaciente) {
    console.error('[crearOReusarPacienteDesdeReserva] Error al crear paciente:', pacErr)
    return null
  }
  return newPaciente.id
}

export type ReservaDesdePagoResultado = {
  turnoId: string | null
  terapeutaId: string | null
  fechaHora: string | null
  duracionMin: number | null
  googleEventId: string | null
  meetLink: string | null
}

const VACIO: ReservaDesdePagoResultado = {
  turnoId: null, terapeutaId: null, fechaHora: null, duracionMin: null, googleEventId: null, meetLink: null,
}

async function avisarSobreturno(db: ReturnType<typeof serviceClient>, reserva: ReservaPendientePago) {
  const { data: prof } = await db.from('profiles').select('email, nombre, apellido').eq('id', reserva.terapeuta_id).maybeSingle()
  if (!prof?.email) return
  try {
    const fecha = formatFechaHoraArgentina(reserva.fecha_hora, 'fecha')
    const hora = formatFechaHoraArgentina(reserva.fecha_hora, 'hora')
    await enviarEmail({
      destinatario: prof.email,
      nombreDestinatario: `${prof.nombre} ${prof.apellido}`,
      asunto: 'Sobreturno: un pago aprobado ocupó un horario ya tomado',
      htmlContent: emailSobreturnoReservaPublica({
        pacienteNombre: `${reserva.nombre} ${reserva.apellido}`,
        fecha,
        hora,
      }),
    })
  } catch (e) {
    console.error('[crearReservaDesdePago] Error al avisar sobreturno al profesional:', e)
  }
}

// Punto único de entrada para "un pago de reserva pública se aprobó" — lo
// llaman tanto el webhook de MP (notificación async) como booking/confirmar
// (Payment Brick, respuesta directa del submit) para el mismo pago, así que
// tiene que ser idempotente: el update atómico de abajo (pendiente→procesada)
// hace que solo UNA de esas dos llamadas cree el paciente/turno reales — la
// otra ve que ya no está 'pendiente' y devuelve el turno ya creado.
export async function crearReservaDesdePago(
  hash: string,
  medioPago: MedioPago,
  pago: DatosPago,
): Promise<ReservaDesdePagoResultado> {
  const db = serviceClient()

  const { data: reclamadas, error: claimErr } = await db
    .from('reservas_pendientes_pago')
    .update({ estado: 'procesada' })
    .eq('hash', hash)
    .eq('estado', 'pendiente')
    .select('*')

  if (claimErr) {
    console.error('[crearReservaDesdePago] Error al reclamar la reserva:', claimErr)
    return VACIO
  }

  if (!reclamadas || reclamadas.length === 0) {
    // No pendiente: ya procesada por la otra vía (webhook/confirmar en
    // simultáneo), vencida, o el hash no existe. Si ya tiene turno_id, es
    // la misma reserva ya resuelta — se devuelve idéntico, nunca se duplica.
    const { data: existente } = await db
      .from('reservas_pendientes_pago')
      .select('turno_id, terapeuta_id')
      .eq('hash', hash)
      .maybeSingle()

    if (!existente?.turno_id) {
      console.error('[crearReservaDesdePago] Reserva no reclamable y sin turno — hash:', hash)
      return VACIO
    }

    const { data: turnoExistente } = await db
      .from('turnos')
      .select('fecha_hora, duracion_min, google_event_id, meet_link')
      .eq('id', existente.turno_id)
      .maybeSingle()

    return {
      turnoId: existente.turno_id,
      terapeutaId: existente.terapeuta_id,
      fechaHora: turnoExistente?.fecha_hora ?? null,
      duracionMin: turnoExistente?.duracion_min ?? null,
      googleEventId: turnoExistente?.google_event_id ?? null,
      meetLink: turnoExistente?.meet_link ?? null,
    }
  }

  const reserva = reclamadas[0] as ReservaPendientePago

  // 1) Crear/reusar paciente
  const pacienteId = await crearOReusarPacienteDesdeReserva(db, reserva)
  if (!pacienteId) return VACIO

  // 2) Re-chequear disponibilidad — pudo pasar tiempo entre crear la reserva
  // y que el pago se apruebe. Si ya no está libre, el turno se crea igual
  // (el pago ya es real) pero como sobreturno, y se avisa al profesional.
  const localDate = zonedDateArgentina(reserva.fecha_hora)
  const fechaStr = format(localDate, 'yyyy-MM-dd')
  const horaStr = format(localDate, 'HH:mm')
  const slotOk = await isSlotAvailable(db, reserva.terapeuta_id, fechaStr, horaStr, reserva.duracion_min)
  const esSobreturno = !slotOk

  // 3) Crear el turno ya confirmado y pagado
  const tipoTurnoColumn = reserva.tipo_turno_id ? 'sesion' : (reserva.tipo_turno === 'sesion' ? 'sesion' : 'entrevista')
  const { data: turno, error: turnoErr } = await db
    .from('turnos')
    .insert({
      terapeuta_id: reserva.terapeuta_id,
      paciente_id: pacienteId,
      fecha_hora: reserva.fecha_hora,
      duracion_min: reserva.duracion_min,
      modalidad: reserva.modalidad,
      estado: 'confirmado' as const,
      pagado: true,
      estado_pago: 'pagado' as const,
      monto: reserva.monto,
      monto_pagado: reserva.monto,
      moneda: reserva.moneda,
      sucursal_id: reserva.sucursal_id,
      es_sobreturno: esSobreturno,
      notas: (!reserva.tipo_turno_id && reserva.tipo_turno === 'entrevista') ? 'Entrevista inicial reservada online' : 'Reserva online',
      tipo_turno: tipoTurnoColumn,
      tipo_turno_id: reserva.tipo_turno_id,
    })
    .select('id')
    .single()

  if (turnoErr || !turno) {
    console.error('[crearReservaDesdePago] Error al crear turno:', turnoErr)
    return VACIO
  }

  if (esSobreturno) {
    await avisarSobreturno(db, reserva)
  }

  // 4) sesiones_pago ya pagada — a diferencia del flujo viejo, esta fila
  // nunca existió "pendiente": se crea directamente como registro histórico
  // del cobro, con el turno_id real (sesiones_pago.turno_id es NOT NULL).
  const { error: sesionPagoErr } = await db.from('sesiones_pago').insert({
    turno_id: turno.id,
    terapeuta_id: reserva.terapeuta_id,
    paciente_id: pacienteId,
    hash: reserva.hash,
    monto: reserva.monto ?? 0,
    moneda: reserva.moneda,
    estado: 'pagado',
    mp_payment_id: pago?.referencia ?? null,
    vence_at: new Date().toISOString(),
  })
  if (sesionPagoErr) console.error('[crearReservaDesdePago] Error al crear sesion_pago pagada:', sesionPagoErr)

  // 5) Calendar/Meet + email de confirmación al paciente
  const { googleEventId, meetLink } = await finalizarReservaConfirmada(turno.id, reserva.terapeuta_id, medioPago, pago)

  // 6) Dejar constancia del turno creado en la reserva ya reclamada
  await db.from('reservas_pendientes_pago').update({ turno_id: turno.id }).eq('hash', reserva.hash)

  return {
    turnoId: turno.id,
    terapeutaId: reserva.terapeuta_id,
    fechaHora: reserva.fecha_hora,
    duracionMin: reserva.duracion_min,
    googleEventId,
    meetLink,
  }
}
