import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { Payment } from 'mercadopago'
import { preApproval, mpClient, mpAccessToken } from '@/lib/mercadopago'
import { enviarEmail } from '@/lib/brevo'
import { emailPagoExitoso, emailPagoFallido, emailSuscripcionCancelada } from '@/lib/email-templates'
import { serviceClient } from '@/lib/supabase/service'

// El SDK de mercadopago no tiene un cliente dedicado para el recurso
// "authorized_payments" (los cobros recurrentes de una preapproval) — es el
// único que devuelve `preapproval_id` directo, así que se consulta con fetch
// crudo contra la REST API. El `Payment` del SDK sí trae `transaction_details`
// (para el monto neto) pero no el link a la preapproval.
async function obtenerAuthorizedPayment(authorizedPaymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`, {
    headers: { Authorization: `Bearer ${mpAccessToken}` },
  })
  if (!res.ok) {
    throw new Error(`MP authorized_payments ${authorizedPaymentId} respondió ${res.status}`)
  }
  return res.json() as Promise<{
    id: number
    preapproval_id: string
    payment: { id: number; status: string; transaction_amount: number }
  }>
}

// El objeto Payment (vía SDK) no trae ningún campo que apunte a su
// preapproval de origen — chequeado contra PaymentResponse del SDK
// (point_of_interaction, metadata, external_reference: ninguno lo trae acá,
// porque la preapproval se crea sin external_reference). El único camino
// documentado por MP es al revés: por cada preapproval buscar sus
// authorized_payments y matchear el id del payment. Se recorre en orden de
// creación descendente porque el caso típico que dispara esto es el primer
// cobro de una suscripción recién creada.
type AuthorizedPaymentSearchItem = {
  id: number
  preapproval_id: string
  payment: { id: number; status: string; transaction_amount: number }
}

async function buscarAuthorizedPaymentPorPreapproval(
  preapprovalId: string,
  paymentId: string,
): Promise<AuthorizedPaymentSearchItem | null> {
  const res = await fetch(
    `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}&limit=50`,
    { headers: { Authorization: `Bearer ${mpAccessToken}` } },
  )
  if (!res.ok) {
    throw new Error(`MP authorized_payments/search (preapproval ${preapprovalId}) respondió ${res.status}`)
  }
  const data = (await res.json()) as { results?: AuthorizedPaymentSearchItem[] }
  const results = Array.isArray(data.results) ? data.results : []
  return results.find((r) => String(r.payment?.id) === paymentId) ?? null
}

async function resolverSuscripcionDePago(
  db: ReturnType<typeof serviceClient>,
  paymentId: string,
): Promise<{ sub: { id: string; terapeuta_id: string; plan: string | null }; preapprovalId: string } | null> {
  const { data: subs } = await db
    .from('suscripciones')
    .select('id, terapeuta_id, plan, mp_preapproval_id')
    .not('mp_preapproval_id', 'is', null)
    .order('created_at', { ascending: false })

  for (const sub of subs ?? []) {
    if (!sub.mp_preapproval_id) continue
    try {
      const found = await buscarAuthorizedPaymentPorPreapproval(sub.mp_preapproval_id, paymentId)
      if (found) {
        return { sub, preapprovalId: sub.mp_preapproval_id }
      }
    } catch (err) {
      console.error('[webhook suscripcion] error buscando authorized_payment por preapproval', sub.mp_preapproval_id, err)
    }
  }
  return null
}

async function guardarPagoSuscripcion(
  db: ReturnType<typeof serviceClient>,
  pago: {
    terapeuta_id: string
    suscripcion_id: string
    mp_payment_id: string
    mp_preapproval_id: string
    plan: string | null
    monto_bruto: number
    monto_neto: number | null
    estado: string
    fecha_pago: string
    raw: Record<string, unknown>
  },
) {
  const { error } = await db.from('pagos_suscripcion').upsert(pago, { onConflict: 'mp_payment_id' })
  if (error) {
    console.error('[webhook suscripcion] error al guardar pago en pagos_suscripcion', pago.mp_payment_id, error)
  }
}

function verificarFirmaMP(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true

  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')

  // El simulador del panel de MP no envía x-signature — dejamos pasar
  if (!xSignature || !xRequestId) return true

  // MP envía: ts=<timestamp>,v1=<hash>
  const parts = Object.fromEntries(xSignature.split(',').map((p) => p.split('=')))
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  // id = data.id del body, no el x-request-id
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  return expected === v1
}

async function obtenerProfile(db: ReturnType<typeof serviceClient>, terapeutaId: string) {
  const { data } = await db
    .from('profiles')
    .select('nombre, email')
    .eq('id', terapeutaId)
    .single()
  return data
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)
    const dataId: string = body.data?.id ?? ''

    if (!verificarFirmaMP(req, dataId)) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }

    if (body.type === 'subscription_authorized_payment') {
      const db = serviceClient()
      const authorizedPayment = await obtenerAuthorizedPayment(dataId)
      const paymentId = String(authorizedPayment.payment.id)

      const { data: sub } = await db
        .from('suscripciones')
        .select('id, terapeuta_id, plan')
        .eq('mp_preapproval_id', authorizedPayment.preapproval_id)
        .maybeSingle()

      if (!sub) {
        console.error('[webhook suscripcion] authorized_payment sin suscripcion asociada', paymentId, authorizedPayment.preapproval_id)
        return NextResponse.json({ ok: true })
      }

      // Monto neto: el recurso authorized_payments no lo trae, hay que pedir
      // el Payment completo (transaction_details.net_received_amount).
      let montoNeto: number | null = null
      try {
        const paymentDetail = await new Payment(mpClient).get({ id: authorizedPayment.payment.id })
        montoNeto = paymentDetail.transaction_details?.net_received_amount ?? null
      } catch (err) {
        console.error('[webhook suscripcion] no se pudo obtener el neto del payment', paymentId, err)
      }

      await guardarPagoSuscripcion(db, {
        terapeuta_id: sub.terapeuta_id,
        suscripcion_id: sub.id,
        mp_payment_id: paymentId,
        mp_preapproval_id: authorizedPayment.preapproval_id,
        plan: sub.plan,
        monto_bruto: authorizedPayment.payment.transaction_amount,
        monto_neto: montoNeto,
        estado: authorizedPayment.payment.status,
        fecha_pago: new Date().toISOString(),
        raw: authorizedPayment as unknown as Record<string, unknown>,
      })

      return NextResponse.json({ ok: true })
    }

    if (body.type === 'payment') {
      const db = serviceClient()
      const paymentId = dataId

      let paymentDetail
      try {
        paymentDetail = await new Payment(mpClient).get({ id: Number(paymentId) })
      } catch (err) {
        console.error('[webhook suscripcion] no se pudo obtener el payment', paymentId, err)
        return NextResponse.json({ ok: true })
      }

      const resuelto = await resolverSuscripcionDePago(db, paymentId)

      if (!resuelto) {
        // No es un cobro de suscripción KLIA (ej. un cobro del profesional a
        // su paciente vía su propia cuenta de MP) — se ignora sin error.
        console.log('[webhook suscripcion] payment sin suscripcion KLIA asociada, ignorado', paymentId)
        return NextResponse.json({ ok: true })
      }

      await guardarPagoSuscripcion(db, {
        terapeuta_id: resuelto.sub.terapeuta_id,
        suscripcion_id: resuelto.sub.id,
        mp_payment_id: paymentId,
        mp_preapproval_id: resuelto.preapprovalId,
        plan: resuelto.sub.plan,
        monto_bruto: paymentDetail.transaction_amount ?? 0,
        monto_neto: paymentDetail.transaction_details?.net_received_amount ?? null,
        estado: paymentDetail.status ?? 'desconocido',
        fecha_pago: paymentDetail.date_approved ?? new Date().toISOString(),
        raw: paymentDetail as unknown as Record<string, unknown>,
      })

      return NextResponse.json({ ok: true })
    }

    if (body.type !== 'subscription_preapproval') {
      console.log('[webhook suscripcion] notificacion no manejada:', body.type, dataId)
      return NextResponse.json({ ok: true })
    }

    const preapprovalId: string = body.data?.id
    if (!preapprovalId) return NextResponse.json({ ok: true })

    const detail = await preApproval.get({ id: preapprovalId })
    const status = detail.status

    const db = serviceClient()

    if (status === 'authorized') {
      await db
        .from('suscripciones')
        .update({
          estado: 'authorized',
          suscripcion_inicio: new Date().toISOString(),
          suscripcion_fin: detail.next_payment_date ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('mp_preapproval_id', preapprovalId)

      const { data: sub } = await db
        .from('suscripciones')
        .select('terapeuta_id, plan, modalidad, monto')
        .eq('mp_preapproval_id', preapprovalId)
        .single()

      if (sub) {
        await db
          .from('profiles')
          .update({
            estado_cuenta: 'activa',
            plan: sub.plan as 'esencial' | 'profesional' | 'premium',
            suscripcion_inicio: new Date().toISOString(),
            suscripcion_fin: detail.next_payment_date ?? null,
          })
          .eq('id', sub.terapeuta_id)

        const profile = await obtenerProfile(db, sub.terapeuta_id)
        if (profile?.email) {
          const proximoCobro = detail.next_payment_date
            ? new Date(detail.next_payment_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'a confirmar'
          enviarEmail({
            destinatario: profile.email,
            nombreDestinatario: profile.nombre ?? profile.email,
            asunto: '¡Pago recibido! Tu suscripción a KLIA está activa',
            htmlContent: emailPagoExitoso(
              profile.nombre ?? profile.email,
              sub.plan ?? 'Premium',
              sub.modalidad ?? 'Mensual',
              sub.monto ?? 0,
              proximoCobro,
            ),
          }).catch(() => {})
        }
      }
    } else if (status === 'paused') {
      await db
        .from('suscripciones')
        .update({ estado: 'paused', updated_at: new Date().toISOString() })
        .eq('mp_preapproval_id', preapprovalId)

      const { data: sub } = await db
        .from('suscripciones')
        .select('terapeuta_id, plan')
        .eq('mp_preapproval_id', preapprovalId)
        .single()

      if (sub) {
        await db
          .from('profiles')
          .update({ estado_cuenta: 'bloqueada' })
          .eq('id', sub.terapeuta_id)

        const profile = await obtenerProfile(db, sub.terapeuta_id)
        if (profile?.email) {
          enviarEmail({
            destinatario: profile.email,
            nombreDestinatario: profile.nombre ?? profile.email,
            asunto: 'Problema con tu pago en KLIA',
            htmlContent: emailPagoFallido(profile.nombre ?? profile.email, sub.plan ?? 'Premium'),
          }).catch(() => {})
        }
      }
    } else if (status === 'cancelled') {
      await db
        .from('suscripciones')
        .update({ estado: 'cancelled', updated_at: new Date().toISOString() })
        .eq('mp_preapproval_id', preapprovalId)

      const { data: sub } = await db
        .from('suscripciones')
        .select('terapeuta_id, suscripcion_fin')
        .eq('mp_preapproval_id', preapprovalId)
        .single()

      if (sub) {
        await db
          .from('profiles')
          .update({ estado_cuenta: 'cancelada' })
          .eq('id', sub.terapeuta_id)

        const profile = await obtenerProfile(db, sub.terapeuta_id)
        if (profile?.email) {
          const fechaAcceso = sub.suscripcion_fin
            ? new Date(sub.suscripcion_fin).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'inmediatamente'
          enviarEmail({
            destinatario: profile.email,
            nombreDestinatario: profile.nombre ?? profile.email,
            asunto: 'Tu suscripción a KLIA fue cancelada',
            htmlContent: emailSuscripcionCancelada(profile.nombre ?? profile.email, fechaAcceso),
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
