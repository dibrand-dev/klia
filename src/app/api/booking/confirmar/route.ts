import { NextRequest, NextResponse } from 'next/server'
import { crearReservaDesdePago } from '@/lib/booking/crear-reserva-desde-pago'
import { formatFechaHoraArgentina } from '@/lib/timezone'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json() as { hash?: string; formData?: Record<string, unknown> }
  const { hash, formData } = body

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
    // Ya confirmada (doble click, reintento del Brick) — idempotente: se
    // devuelve el turno ya creado, nunca se vuelve a cobrar.
    const [{ data: turno }, { data: sesionPago }] = await Promise.all([
      db.from('turnos').select('fecha_hora, duracion_min, google_event_id, meet_link').eq('id', reserva.turno_id).maybeSingle(),
      db.from('sesiones_pago').select('mp_payment_id').eq('turno_id', reserva.turno_id).maybeSingle(),
    ])
    const fechaHora = turno?.fecha_hora ?? ''
    return NextResponse.json({
      ok: true,
      turno_id: reserva.turno_id,
      mp_payment_id: sesionPago?.mp_payment_id ?? null,
      fecha_fmt: formatFechaHoraArgentina(fechaHora, 'fecha'),
      hora: formatFechaHoraArgentina(fechaHora, 'hora'),
      duracion: turno?.duracion_min ?? 50,
      monto: reserva.monto ?? 0,
      moneda: reserva.moneda,
      referencia: sesionPago?.mp_payment_id ?? hash,
      medio_pago: 'mp' as const,
      google_event_id: turno?.google_event_id ?? null,
      meet_link: turno?.meet_link ?? null,
    })
  }

  if (reserva.estado !== 'pendiente') {
    return NextResponse.json({ error: 'La reserva ya no está disponible' }, { status: 409 })
  }

  const { data: profile } = await db
    .from('profiles')
    .select('nombre, apellido, mp_access_token')
    .eq('id', reserva.terapeuta_id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Datos no encontrados' }, { status: 404 })
  }

  if (!profile.mp_access_token) {
    return NextResponse.json({ error: 'Profesional sin Mercado Pago configurado' }, { status: 400 })
  }

  // Procesar el pago con MP — el turno/paciente todavía no existen, se crean
  // recién si el pago queda aprobado (crearReservaDesdePago).
  const mpPayload = {
    ...(formData ?? {}),
    transaction_amount: reserva.monto,
    description: `${reserva.tipo_turno === 'entrevista' ? 'Entrevista inicial' : 'Sesión'} con ${profile.nombre} ${profile.apellido}`,
    metadata: { hash, booking: true },
  }

  const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${profile.mp_access_token}`,
      'X-Idempotency-Key': hash,
    },
    body: JSON.stringify(mpPayload),
  })

  const mpData = await mpRes.json() as { id?: number; status?: string; status_detail?: string }
  const mpStatus = mpData.status ?? 'rejected'
  const mpPaymentId = mpData.id ? String(mpData.id) : null

  if (mpStatus !== 'approved') {
    // Rechazado o pendiente: no se crea nada — la reserva sigue 'pendiente'
    // para que el paciente pueda reintentar hasta que expire.
    return NextResponse.json(
      { error: 'payment_rejected', detail: mpData.status_detail },
      { status: 402 }
    )
  }

  const resultado = await crearReservaDesdePago(hash, 'mercadopago', {
    monto: reserva.monto ?? 0,
    moneda: reserva.moneda ?? 'ARS',
    referencia: mpPaymentId ?? hash,
  })

  if (!resultado.turnoId) {
    console.error('[booking/confirmar] crearReservaDesdePago no devolvió turno para hash:', hash)
    return NextResponse.json({ error: 'No se pudo confirmar la reserva' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    turno_id: resultado.turnoId,
    mp_payment_id: mpPaymentId,
    fecha_fmt: formatFechaHoraArgentina(resultado.fechaHora ?? '', 'fecha'),
    hora: formatFechaHoraArgentina(resultado.fechaHora ?? '', 'hora'),
    duracion: resultado.duracionMin ?? 50,
    monto: reserva.monto ?? 0,
    moneda: reserva.moneda,
    referencia: mpPaymentId ?? hash,
    medio_pago: 'mp' as const,
    google_event_id: resultado.googleEventId,
    meet_link: resultado.meetLink,
  })
}
