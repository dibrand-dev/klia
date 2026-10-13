import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailPagoSesionConfirmada, emailPagoSesionRechazada, emailPagoRecibidoTurnoCancelado } from '@/lib/email-templates'
import type { Database } from '@/types/database'
import { mpAccessToken } from '@/lib/mercadopago'
import { sincronizarTurnoCreado } from '@/lib/sync-google-calendar'
import { formatFechaHoraAR } from '@/lib/tz'
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

// sesiones_pago no está en el Database generado (types/database.ts
// desactualizado) — mismo patrón de Record<string, unknown> que ya usa el
// resto de este archivo para turno/profile.
type SesionPago = Record<string, unknown> & {
  id: string
  hash: string
  terapeuta_id: string
  turno_id: string
  monto: number
  moneda: string
  estado: string
  intentos_fallidos: number
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

  // Preferencias nuevas (pagos/crear y booking/mp-preferencia) mandan
  // notification_url con ?hash=... — eso nos deja cargar la sesión ANTES de
  // llamar a MP, y así usar el access_token del profesional dueño de la
  // sesión en vez del token de plataforma. Las preferencias viejas (sin
  // hash en la URL, ya enviadas antes de este fix) siguen resolviéndose con
  // el token de plataforma + metadata/preference_id, como antes.
  const hashQuery = new URL(req.url).searchParams.get('hash')

  let sesion: SesionPago | null = null
  let mpPayment: Record<string, unknown> | null = null

  if (hashQuery) {
    const { data: sesionData } = await db.from('sesiones_pago').select('*').eq('hash', hashQuery).maybeSingle()
    if (!sesionData) return NextResponse.json({ ok: true })
    sesion = sesionData as SesionPago

    const { data: profToken } = await db.from('profiles').select('mp_access_token').eq('id', sesion.terapeuta_id).single()
    if (!profToken?.mp_access_token) {
      console.error('[webhook] Profesional sin mp_access_token:', sesion.terapeuta_id)
      return NextResponse.json({ ok: true })
    }

    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${profToken.mp_access_token}` },
    })
    if (!payRes.ok) {
      console.error('[webhook] Could not fetch payment (token profesional)', paymentId, await payRes.text())
      return NextResponse.json({ ok: true })
    }
    mpPayment = await payRes.json() as Record<string, unknown>
  } else {
    // Fallback preferencias viejas sin ?hash: token de plataforma actual.
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    })
    if (!payRes.ok) {
      console.error('[webhook] Could not fetch payment (token plataforma)', paymentId, await payRes.text())
      return NextResponse.json({ ok: true })
    }
    mpPayment = await payRes.json() as Record<string, unknown>

    const metadata = mpPayment.metadata as Record<string, unknown> | null
    const prefId = mpPayment.preference_id as string | null

    let sesionQuery = db.from('sesiones_pago').select('*')
    if (metadata?.hash) {
      sesionQuery = sesionQuery.eq('hash', metadata.hash as string)
    } else if (prefId) {
      sesionQuery = sesionQuery.eq('mp_preference_id', prefId)
    } else {
      return NextResponse.json({ ok: true })
    }

    const { data: sesionData } = await sesionQuery.maybeSingle()
    if (!sesionData) return NextResponse.json({ ok: true })
    sesion = sesionData as SesionPago
  }

  // El pago tiene que corresponder a esta sesión: mismo hash en metadata y
  // monto cobrado no menor al adeudado. Si no coincide, nunca se toca nada.
  const metadataHash = (mpPayment.metadata as Record<string, unknown> | null)?.hash as string | undefined
  const transactionAmount = mpPayment.transaction_amount as number | undefined
  if (metadataHash !== sesion.hash || (transactionAmount ?? 0) < sesion.monto) {
    console.error('[webhook] Pago no corresponde a la sesión — hash o monto no coinciden', {
      paymentId, sesionId: sesion.id, metadataHash, sesionHash: sesion.hash, transactionAmount, monto: sesion.monto,
    })
    return NextResponse.json({ ok: true })
  }

  const mpStatus = mpPayment.status as string

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
  const { fecha, hora } = formatFechaHoraAR(turno.fecha_hora)

  if (mpStatus === 'approved') {
    // Idempotencia atómica: reclama la sesión solo si todavía no estaba
    // pagada. Un reintento de MP sobre un pago ya procesado no afecta
    // ninguna fila acá — se corta antes de tocar el turno o mandar mails.
    const { data: reclamada, error: sesionErr } = await db.from('sesiones_pago')
      .update({ estado: 'pagado', mp_payment_id: String(paymentId), updated_at: new Date().toISOString() })
      .eq('id', sesion.id)
      .neq('estado', 'pagado')
      .select('id')

    if (sesionErr) {
      console.error('[webhook] Error al marcar sesion_pago pagado:', sesionErr)
      return NextResponse.json({ ok: true })
    }
    if (!reclamada || reclamada.length === 0) {
      return NextResponse.json({ ok: true })
    }

    const turnoYaCancelado = turno.estado === 'cancelado'

    if (turnoYaCancelado) {
      // Pago tardío sobre un turno que ya se canceló (venció, lo canceló el
      // paciente, etc.) — nunca se resucita. Solo se deja constancia de que
      // el pago entró, para que el profesional lo resuelva con el paciente.
      const { error: turnoErr } = await db.from('turnos')
        .update({ pagado: true, estado_pago: 'pagado', monto_pagado: sesion.monto })
        .eq('id', turno.id)
      if (turnoErr) console.error('[webhook] Error al marcar turno cancelado como pagado:', turnoErr)

      if (prof?.email) {
        try {
          await enviarEmail({
            destinatario: prof.email as string,
            nombreDestinatario: `${prof.nombre as string} ${prof.apellido as string}`,
            asunto: `Pago recibido para un turno ya cancelado — ${paciente?.nombre as string} ${paciente?.apellido as string}`,
            htmlContent: emailPagoRecibidoTurnoCancelado({
              pacienteNombre: `${paciente?.nombre as string} ${paciente?.apellido as string}`,
              fecha,
              hora,
              monto: sesion.monto,
              moneda: sesion.moneda,
            }),
          })
        } catch (e) { console.error('[webhook] email pago tardío (turno cancelado) error:', e) }
      }
    } else {
      const { error: turnoErr } = await db.from('turnos')
        .update({ estado: 'confirmado', pagado: true, estado_pago: 'pagado', monto_pagado: sesion.monto })
        .eq('id', turno.id)
      if (turnoErr) console.error('[webhook] Error al confirmar turno:', turnoErr)

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

      // Sync to Google Calendar — directo, no vía fetch interno (ese
      // endpoint exige sesión de usuario y le daría 401 a este webhook).
      if (!turno.google_event_id) {
        try {
          await sincronizarTurnoCreado(turno.id, sesion.terapeuta_id)
        } catch (e) { console.error('[webhook] Error sincronizando Google Calendar:', e) }
      }
    }

  } else if (mpStatus === 'rejected') {
    const nuevoIntentos = sesion.intentos_fallidos + 1

    if (nuevoIntentos >= 3) {
      const { error: sesionErr } = await db.from('sesiones_pago')
        .update({ estado: 'rechazado', intentos_fallidos: nuevoIntentos, updated_at: new Date().toISOString() })
        .eq('id', sesion.id)
      if (sesionErr) console.error('[webhook] Error al marcar sesion_pago rechazado:', sesionErr)

      const { error: turnoErr } = await db.from('turnos').update({ estado: 'cancelado' }).eq('id', turno.id)
      if (turnoErr) console.error('[webhook] Error al cancelar turno por pago rechazado:', turnoErr)

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
      const { error: sesionErr } = await db.from('sesiones_pago')
        .update({ intentos_fallidos: nuevoIntentos, updated_at: new Date().toISOString() })
        .eq('id', sesion.id)
      if (sesionErr) console.error('[webhook] Error al incrementar intentos_fallidos:', sesionErr)
    }
  }
  // pending → no action

  return NextResponse.json({ ok: true })
}
