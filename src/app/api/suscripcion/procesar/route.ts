import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PreApproval } from 'mercadopago'
import { mpClient, getPlanInfo, type PlanKlia, type Modalidad } from '@/lib/mercadopago'
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

  const planInfo = await getPlanInfo(supabase, plan, user.id)
  if (!planInfo) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }
  const monto = modalidad === 'mensual' ? planInfo.precio_mensual : planInfo.precio_anual_mensual
  if (monto == null) {
    return NextResponse.json({ error: 'Modalidad no disponible para este plan' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

  const preApprovalClient = new PreApproval(mpClient)

  let sub
  try {
    sub = await preApprovalClient.create({
      body: {
        reason: `${planInfo.nombre} — ${modalidad === 'mensual' ? 'Mensual' : 'Anual'}`,
        payer_email: (formData.payer as { email?: string } | undefined)?.email ?? user.email!,
        card_token_id: formData.token as string | undefined,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: monto,
          currency_id: 'ARS',
        },
        back_url: `${appUrl}/suscripcion/resultado`,
        status: 'authorized',
      },
    })
  } catch (err) {
    console.error('[procesar] PreApproval.create falló:', err)
    return NextResponse.json(
      { error: 'No pudimos procesar el pago. Verificá los datos de la tarjeta e intentá de nuevo.' },
      { status: 422 },
    )
  }

  if (sub.status !== 'authorized') {
    console.error('[procesar] PreApproval creado pero no autorizado:', sub.status, sub.id)
    return NextResponse.json(
      { error: `El pago no pudo autorizarse (estado: ${sub.status}).` },
      { status: 422 },
    )
  }

  const db = serviceClient()

  await db.from('suscripciones').insert({
    terapeuta_id: user.id,
    plan,
    modalidad,
    mp_preapproval_id: sub.id,
    estado: 'authorized',
    monto,
    suscripcion_inicio: new Date().toISOString(),
  })

  await db
    .from('profiles')
    .update({
      estado_cuenta: 'activa',
      plan: plan as 'esencial' | 'profesional' | 'premium',
      suscripcion_inicio: new Date().toISOString(),
    })
    .eq('id', user.id)

  return NextResponse.json({ ok: true, status: sub.status })
}
