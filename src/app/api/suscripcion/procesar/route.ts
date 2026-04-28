import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Payment, PreApproval } from 'mercadopago'
import { mpClient, PLANES_KLIA, getMonto, type PlanKlia, type Modalidad } from '@/lib/mercadopago'
import type { Database } from '@/types/database'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { plan, modalidad, ...formData } = body as {
    plan: PlanKlia
    modalidad: Modalidad
    token?: string
    payment_method_id?: string
    issuer_id?: string | number
    installments?: number
    payer?: {
      email?: string
      identification?: { type: string; number: string }
    }
    [key: string]: unknown
  }

  if (!PLANES_KLIA[plan]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const monto = getMonto(plan, modalidad)
  const planInfo = PLANES_KLIA[plan]

  const paymentClient = new Payment(mpClient)
  const payment = await paymentClient.create({
    body: {
      transaction_amount: monto,
      token: formData.token as string | undefined,
      payment_method_id: formData.payment_method_id as string | undefined,
      issuer_id: formData.issuer_id != null ? Number(formData.issuer_id) : undefined,
      installments: (formData.installments as number | undefined) ?? 1,
      payer: {
        email: (formData.payer as { email?: string } | undefined)?.email ?? user.email!,
        identification: (formData.payer as { identification?: { type: string; number: string } } | undefined)?.identification,
      },
      description: `${planInfo.nombre} — ${modalidad === 'mensual' ? 'Mensual' : 'Anual'}`,
    },
  })

  const paymentStatus = payment.status
  if (paymentStatus !== 'approved' && paymentStatus !== 'in_process') {
    return NextResponse.json(
      { error: `Pago ${paymentStatus ?? 'rechazado'}. Verificá los datos de tu tarjeta.` },
      { status: 422 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'
  let preapprovalId: string | undefined

  try {
    const preApprovalClient = new PreApproval(mpClient)
    const sub = await preApprovalClient.create({
      body: {
        reason: `${planInfo.nombre} — ${modalidad === 'mensual' ? 'Mensual' : 'Anual'}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: monto,
          currency_id: 'ARS',
        },
        back_url: `${appUrl}/suscripcion/resultado`,
        payer_email: (formData.payer as { email?: string } | undefined)?.email ?? user.email!,
        status: 'authorized',
        card_token_id: formData.token as string | undefined,
      },
    })
    preapprovalId = sub.id
  } catch {
    // PreApproval may fail for non-card payment methods; proceed without it
  }

  const db = serviceClient()

  await db.from('suscripciones').insert({
    terapeuta_id: user.id,
    plan,
    modalidad,
    mp_preapproval_id: preapprovalId ?? null,
    estado: paymentStatus === 'approved' ? 'authorized' : 'pending',
    monto,
    suscripcion_inicio: new Date().toISOString(),
  })

  if (paymentStatus === 'approved') {
    await db
      .from('profiles')
      .update({
        estado_cuenta: 'activa',
        plan: plan as 'esencial' | 'profesional' | 'premium',
        suscripcion_inicio: new Date().toISOString(),
        mp_subscription_id: preapprovalId ?? null,
      })
      .eq('id', user.id)
  }

  return NextResponse.json({ ok: true, status: paymentStatus })
}
