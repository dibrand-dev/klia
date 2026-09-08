import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { turno_id?: string; hash?: string }
  const { turno_id: turnoId, hash } = body

  if (!turnoId || !hash) {
    return NextResponse.json({ error: 'turno_id y hash requeridos' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: turno } = await db
    .from('turnos')
    .select('id, terapeuta_id, paciente_id, monto, moneda, estado, tipo_turno')
    .eq('id', turnoId)
    .single()

  if (!turno) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  if (turno.estado === 'cancelado') {
    return NextResponse.json({ error: 'El turno fue cancelado' }, { status: 409 })
  }

  if (!turno.monto) {
    return NextResponse.json({ error: 'El turno no tiene monto a pagar' }, { status: 400 })
  }

  const [{ data: profile }, { data: paciente }] = await Promise.all([
    db.from('profiles')
      .select('id, nombre, apellido, booking_slug, mp_access_token, mp_public_key')
      .eq('id', turno.terapeuta_id)
      .single(),
    db.from('pacientes')
      .select('email')
      .eq('id', turno.paciente_id)
      .single(),
  ])

  if (!profile?.mp_access_token || !profile.mp_public_key) {
    return NextResponse.json({ error: 'El profesional no tiene Mercado Pago conectado' }, { status: 400 })
  }

  if (!paciente?.email) {
    return NextResponse.json({ error: 'No se pudo determinar el email del paciente' }, { status: 500 })
  }

  const esEntrevista = turno.tipo_turno === 'entrevista'
  const venceAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

  const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${profile.mp_access_token}`,
    },
    body: JSON.stringify({
      items: [{
        title: `${esEntrevista ? 'Entrevista inicial' : 'Sesión'} con ${profile.nombre} ${profile.apellido}`,
        quantity: 1,
        unit_price: turno.monto,
        currency_id: turno.moneda,
      }],
      payer: { email: paciente.email },
      back_urls: {
        success: `${appUrl}/p/${profile.booking_slug}?status=success&hash=${hash}`,
        failure: `${appUrl}/p/${profile.booking_slug}?status=failure&hash=${hash}`,
        pending: `${appUrl}/p/${profile.booking_slug}?status=pending&hash=${hash}`,
      },
      auto_return: 'approved',
      notification_url: `${appUrl}/api/pagos/webhook`,
      metadata: { hash, turno_id: turno.id, terapeuta_id: profile.id, booking: true },
      statement_descriptor: 'KLIA TURNO',
      expires: true,
      expiration_date_to: venceAt,
    }),
  })

  if (!prefRes.ok) {
    const errText = await prefRes.text()
    console.error('[booking/mp-preferencia] MP preference error:', errText)
    // Still create sesion_pago without preference — permite reintentar/registrar el pago a mano
    await db.from('sesiones_pago').insert({
      turno_id: turno.id,
      terapeuta_id: profile.id,
      paciente_id: turno.paciente_id,
      hash,
      monto: turno.monto,
      moneda: turno.moneda,
      vence_at: venceAt,
    })
    return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 502 })
  }

  const pref = await prefRes.json() as { id: string }

  await db.from('sesiones_pago').insert({
    turno_id: turno.id,
    terapeuta_id: profile.id,
    paciente_id: turno.paciente_id,
    hash,
    monto: turno.monto,
    moneda: turno.moneda,
    mp_preference_id: pref.id,
    vence_at: venceAt,
  })

  return NextResponse.json({
    preference_id: pref.id,
    mp_public_key: profile.mp_public_key,
  })
}
