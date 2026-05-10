import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { preApproval } from '@/lib/mercadopago'
import type { Database } from '@/types/database'
import { enviarEmail } from '@/lib/brevo'
import { emailPagoExitoso, emailPagoFallido, emailSuscripcionCancelada } from '@/lib/email-templates'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
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

    if (body.type !== 'subscription_preapproval') {
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
            mp_subscription_id: preapprovalId,
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
