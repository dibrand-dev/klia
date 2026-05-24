import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailBookingConfirmacion } from '@/lib/email-templates'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { hash?: string; formData?: Record<string, unknown> }
  const { hash, formData } = body

  if (!hash) {
    return NextResponse.json({ error: 'hash requerido' }, { status: 400 })
  }

  const db = serviceClient()

  // 1. Find sesion_pago by hash
  const { data: sesion } = await db
    .from('sesiones_pago')
    .select('*')
    .eq('hash', hash)
    .maybeSingle()

  if (!sesion) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  if (sesion.estado === 'pagado') {
    // Already confirmed (idempotent)
    const { data: turno } = await db.from('turnos').select('fecha_hora, duracion_min').eq('id', sesion.turno_id).single()
    const fechaHora = turno?.fecha_hora ?? ''
    const d = parseISO(fechaHora)
    return NextResponse.json({
      ok: true,
      turno_id: sesion.turno_id,
      mp_payment_id: sesion.mp_payment_id,
      fecha_fmt: format(d, "EEEE d 'de' MMMM yyyy", { locale: es }),
      hora: format(d, 'HH:mm'),
      duracion: turno?.duracion_min ?? 50,
      monto: sesion.monto,
      moneda: sesion.moneda,
      referencia: sesion.mp_payment_id ?? hash,
    })
  }

  // 2. Get turno + professional profile
  const [{ data: turno }, { data: profile }] = await Promise.all([
    db.from('turnos').select('*, paciente:pacientes(*)').eq('id', sesion.turno_id).single(),
    db.from('profiles').select('nombre, apellido, especialidad, mp_access_token').eq('id', sesion.terapeuta_id).single(),
  ])

  if (!turno || !profile) {
    return NextResponse.json({ error: 'Datos no encontrados' }, { status: 404 })
  }

  if (!profile.mp_access_token) {
    return NextResponse.json({ error: 'Profesional sin Mercado Pago configurado' }, { status: 400 })
  }

  // 3. Process MP payment
  const mpPayload = {
    ...(formData ?? {}),
    transaction_amount: sesion.monto,
    description: `${turno.notas ?? 'Sesión'} con ${profile.nombre} ${profile.apellido}`,
    metadata: { hash, turno_id: turno.id, terapeuta_id: sesion.terapeuta_id },
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
    await db.from('sesiones_pago')
      .update({ estado: 'fallido', mp_payment_id: mpPaymentId, updated_at: new Date().toISOString() })
      .eq('id', sesion.id)

    return NextResponse.json(
      { error: 'payment_rejected', detail: mpData.status_detail },
      { status: 402 }
    )
  }

  // 4. Mark as paid
  await Promise.all([
    db.from('sesiones_pago')
      .update({ estado: 'pagado', mp_payment_id: mpPaymentId, updated_at: new Date().toISOString() })
      .eq('id', sesion.id),
    db.from('turnos')
      .update({ estado: 'confirmado', pagado: true, estado_pago: 'pagado', monto_pagado: sesion.monto })
      .eq('id', turno.id),
  ])

  // 5. Send confirmation email
  const d = parseISO(turno.fecha_hora)
  const fechaFmt = format(d, "EEEE d 'de' MMMM yyyy", { locale: es })
  const horaFmt = format(d, 'HH:mm')
  const paciente = turno.paciente as Record<string, unknown> | null
  const tipoLabel = turno.notas?.includes('Entrevista') ? 'Entrevista inicial' : 'Sesión'
  const modalidadMap: Record<string, string> = { presencial: 'Presencial', videollamada: 'Videollamada', telefonica: 'Telefónica' }

  if (paciente?.email) {
    try {
      await enviarEmail({
        destinatario: paciente.email as string,
        nombreDestinatario: `${paciente.nombre as string} ${paciente.apellido as string}`,
        asunto: `Reserva confirmada con ${profile.nombre} ${profile.apellido} — KLIA`,
        htmlContent: emailBookingConfirmacion({
          pacienteNombre: `${paciente.nombre as string} ${paciente.apellido as string}`,
          profesionalNombre: `${profile.nombre} ${profile.apellido}`,
          especialidad: profile.especialidad ?? '',
          tipo: tipoLabel,
          fecha: fechaFmt,
          hora: horaFmt,
          duracion: turno.duracion_min,
          modalidad: modalidadMap[turno.modalidad] ?? turno.modalidad,
          monto: sesion.monto,
          moneda: sesion.moneda,
          referencia: mpPaymentId ?? hash,
        }),
      })
    } catch (e) {
      console.error('[booking/confirmar] email error:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    turno_id: turno.id,
    mp_payment_id: mpPaymentId,
    fecha_fmt: fechaFmt,
    hora: horaFmt,
    duracion: turno.duracion_min,
    monto: sesion.monto,
    moneda: sesion.moneda,
    referencia: mpPaymentId ?? hash,
  })
}
