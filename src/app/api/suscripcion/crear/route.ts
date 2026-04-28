import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Preference } from 'mercadopago'
import { mpClient, PLANES_KLIA, getMonto, type PlanKlia, type Modalidad } from '@/lib/mercadopago'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { plan, modalidad } = body as { plan: PlanKlia; modalidad: Modalidad }

  if (!PLANES_KLIA[plan]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const monto = getMonto(plan, modalidad)
  const planInfo = PLANES_KLIA[plan]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

  const preference = new Preference(mpClient)
  const result = await preference.create({
    body: {
      items: [
        {
          id: plan,
          title: `${planInfo.nombre} — ${modalidad === 'mensual' ? 'Mensual' : 'Anual'}`,
          quantity: 1,
          unit_price: monto,
          currency_id: 'ARS',
        },
      ],
      back_urls: {
        success: `${appUrl}/suscripcion/resultado`,
        failure: `${appUrl}/suscripcion/resultado`,
        pending: `${appUrl}/suscripcion/resultado`,
      },
      auto_return: 'approved',
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }],
      },
      metadata: {
        terapeuta_id: user.id,
        plan,
        modalidad,
        monto,
      },
    },
  })

  if (!result.id) {
    return NextResponse.json({ error: 'Error al crear preferencia en Mercado Pago' }, { status: 500 })
  }

  return NextResponse.json({ preference_id: result.id, monto })
}
