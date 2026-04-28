import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { preApproval } from '@/lib/mercadopago'
import type { Database } from '@/types/database'

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
        .select('terapeuta_id, plan')
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
      }
    } else if (status === 'paused') {
      await db
        .from('suscripciones')
        .update({ estado: 'paused', updated_at: new Date().toISOString() })
        .eq('mp_preapproval_id', preapprovalId)

      const { data: sub } = await db
        .from('suscripciones')
        .select('terapeuta_id')
        .eq('mp_preapproval_id', preapprovalId)
        .single()

      if (sub) {
        await db
          .from('profiles')
          .update({ estado_cuenta: 'bloqueada' })
          .eq('id', sub.terapeuta_id)
      }
    } else if (status === 'cancelled') {
      await db
        .from('suscripciones')
        .update({ estado: 'cancelled', updated_at: new Date().toISOString() })
        .eq('mp_preapproval_id', preapprovalId)

      const { data: sub } = await db
        .from('suscripciones')
        .select('terapeuta_id')
        .eq('mp_preapproval_id', preapprovalId)
        .single()

      if (sub) {
        await db
          .from('profiles')
          .update({ estado_cuenta: 'cancelada' })
          .eq('id', sub.terapeuta_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
