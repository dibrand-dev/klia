import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailPagoSesionConfirmada, emailPagoSesionRechazada } from '@/lib/email-templates'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Database } from '@/types/database'
import { mpAccessToken } from '@/lib/mercadopago'
import crypto from 'crypto'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function validateSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true // skip if not configured

  const xSig = req.headers.get('x-signature')
  const xReqId = req.headers.get('x-request-id')
  const dataId = new URL(req.url).searchParams.get('data.id')

  if (!xSig) return false

  // xSig format: "ts=TIMESTAMP,v1=SIGNATURE"
  const parts = Object.fromEntries(xSig.split(',').map(s => s.split('=')))
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  const signed = `id:${dataId ?? ''};request-id:${xReqId ?? ''};ts:${ts};`
  const computed = crypto.createHmac('sha256', secret).update(signed).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(v1))
}

function formatFechaHora(fechaHora: string) {
  const d = parseISO(fechaHora)
  return {
    fecha: format(d, "EEEE d 'de' MMMM, yyyy", { locale: es }),
    hora: format(d, 'HH:mm'),
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!validateSignature(req, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true }) // always 200 to MP
  }

  // MP sends different event types — only handle payment
  const topic = body.type as string
  if (topic !== 'payment') return NextResponse.json({ ok: true })

  const paymentId = (body.data as Record<string, unknown>)?.id as string
  if (!paymentId) return NextResponse.json({ ok: true })

  const db = serviceClient()

  // Get payment details from MP — we need to find which professional's token to use
  // First, try to find sesion_pago by searching metadata
  // MP payment detail endpoint (using platform-level access)
  let mpPayment: Record<string, unknown> | null = null

  // Try with platform token to get payment data
  const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpAccessToken}` },
  })

  if (payRes.ok) {
    mpPayment = await payRes.json() as Record<string, unknown>
  } else {
    console.error('[webhook] Could not fetch payment', paymentId, await payRes.text())
    return NextResponse.json({ ok: true })
  }

  const metadata = mpPayment.metadata as Record<string, unknown> | null
  const prefId = mpPayment.preference_id as string | null
  const mpStatus = mpPayment.status as string

  // Find sesion_pago by preference_id or hash in metadata
  let sesionQuery = db.from('sesiones_pago').select('*')
  if (metadata?.hash) {
    sesionQuery = sesionQuery.eq('hash', metadata.hash as string)
  } else if (prefId) {
    sesionQuery = sesionQuery.eq('mp_preference_id', prefId)
  } else {
    return NextResponse.json({ ok: true })
  }

  const { data: sesion } = await sesionQuery.maybeSingle()
  if (!sesion) return NextResponse.json({ ok: true })

  // Get turno + paciente + professional
  const { data: turno } = await db
    .from('turnos')
    .select('*, paciente:pacientes(*)')
    .eq('id', sesion.turno_id)
    .single()

  if (!turno) return NextResponse.json({ ok: true })

  const { data: profile } = await db.from('profiles').select('*').eq('id', sesion.terapeuta_id).single()
  const prof = profile as Record<string, unknown> | null
  const paciente = turno.paciente as Record<string, unknown> | null
  const { fecha, hora } = formatFechaHora(turno.fecha_hora)

  if (mpStatus === 'approved') {
    // Mark payment as paid
    await db.from('sesiones_pago')
      .update({ estado: 'pagado', mp_payment_id: String(paymentId), updated_at: new Date().toISOString() })
      .eq('id', sesion.id)

    await db.from('turnos')
      .update({ estado: 'confirmado', pagado: true, estado_pago: 'pagado', monto_pagado: sesion.monto })
      .eq('id', turno.id)

    // Send confirmation email to patient
    if (paciente?.email) {
      try {
        await enviarEmail({
          destinatario: paciente.email as string,
          nombreDestinatario: `${paciente.nombre as string} ${paciente.apellido as string}`,
          asunto: `Sesión confirmada con ${prof?.nombre as string} ${prof?.apellido as string}`,
          htmlContent: emailPagoSesionConfirmada({
            pacienteNombre: `${paciente.nombre as string} ${paciente.apellido as string}`,
            profesionalNombre: `${prof?.nombre as string} ${prof?.apellido as string}`,
            fecha,
            hora,
            duracion: turno.duracion_min,
            modalidad: turno.modalidad,
            monto: sesion.monto,
            moneda: sesion.moneda,
          }),
        })
      } catch (e) { console.error('[webhook] email confirmada error:', e) }
    }

    // Sync to Google Calendar
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: turno.id, action: 'create' }),
      })
    } catch { /* non-critical */ }

  } else if (mpStatus === 'rejected') {
    const nuevoIntentos = sesion.intentos_fallidos + 1

    if (nuevoIntentos >= 3) {
      await db.from('sesiones_pago')
        .update({ estado: 'rechazado', intentos_fallidos: nuevoIntentos, updated_at: new Date().toISOString() })
        .eq('id', sesion.id)

      await db.from('turnos').update({ estado: 'cancelado' }).eq('id', turno.id)

      // Email to patient
      if (paciente?.email) {
        try {
          await enviarEmail({
            destinatario: paciente.email as string,
            nombreDestinatario: `${paciente.nombre as string} ${paciente.apellido as string}`,
            asunto: 'No pudimos procesar tu pago — tu sesión fue cancelada',
            htmlContent: emailPagoSesionRechazada({
              destinatario: 'paciente',
              pacienteNombre: `${paciente.nombre as string} ${paciente.apellido as string}`,
              profesionalNombre: `${prof?.nombre as string} ${prof?.apellido as string}`,
              fecha,
              hora,
            }),
          })
        } catch (e) { console.error('[webhook] email rechazada paciente error:', e) }
      }

      // Email to professional
      if (prof?.email) {
        try {
          await enviarEmail({
            destinatario: prof.email as string,
            nombreDestinatario: `${prof.nombre as string} ${prof.apellido as string}`,
            asunto: `La sesión del ${fecha} con ${paciente?.nombre as string} no fue confirmada`,
            htmlContent: emailPagoSesionRechazada({
              destinatario: 'profesional',
              pacienteNombre: `${paciente?.nombre as string} ${paciente?.apellido as string}`,
              profesionalNombre: `${prof.nombre as string} ${prof.apellido as string}`,
              fecha,
              hora,
            }),
          })
        } catch (e) { console.error('[webhook] email rechazada profesional error:', e) }
      }
    } else {
      await db.from('sesiones_pago')
        .update({ intentos_fallidos: nuevoIntentos, updated_at: new Date().toISOString() })
        .eq('id', sesion.id)
    }
  }
  // pending → no action

  return NextResponse.json({ ok: true })
}
