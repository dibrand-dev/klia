import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

export async function POST(req: NextRequest) {
  const body = await req.json() as { hash?: string }
  const { hash } = body

  if (!hash) {
    return NextResponse.json({ error: 'hash requerido' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: reserva } = await db
    .from('reservas_pendientes_pago')
    .select('*')
    .eq('hash', hash)
    .maybeSingle()

  if (!reserva) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }

  if (reserva.estado !== 'pendiente') {
    return NextResponse.json({ error: 'La reserva ya fue procesada' }, { status: 409 })
  }

  if (!reserva.monto) {
    return NextResponse.json({ error: 'La reserva no tiene monto a pagar' }, { status: 400 })
  }

  const { data: profile } = await db
    .from('profiles')
    .select('id, nombre, apellido, booking_slug, mp_access_token, mp_public_key')
    .eq('id', reserva.terapeuta_id)
    .single()

  if (!profile?.mp_access_token || !profile.mp_public_key) {
    return NextResponse.json({ error: 'El profesional no tiene Mercado Pago conectado' }, { status: 400 })
  }

  if (!reserva.email) {
    return NextResponse.json({ error: 'No se pudo determinar el email del paciente' }, { status: 500 })
  }

  // El turno todavía no existe (se crea recién si el pago se aprueba), así
  // que el nombre del tipo se resuelve directo desde lo que ya quedó
  // guardado en la reserva, sin depender de ningún turno.
  let nombreTipoPropio: string | null = null
  if (reserva.tipo_turno_id) {
    const { data: tipoPropio } = await db.from('tipos_turno').select('nombre').eq('id', reserva.tipo_turno_id).maybeSingle()
    nombreTipoPropio = tipoPropio?.nombre ?? null
  }
  const esEntrevista = reserva.tipo_turno === 'entrevista'
  const tipoLabel = nombreTipoPropio ?? (esEntrevista ? 'Entrevista inicial' : 'Sesión')

  const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${profile.mp_access_token}`,
    },
    body: JSON.stringify({
      items: [{
        title: `${tipoLabel} con ${profile.nombre} ${profile.apellido}`,
        quantity: 1,
        unit_price: reserva.monto,
        currency_id: reserva.moneda,
      }],
      payer: { email: reserva.email },
      back_urls: {
        success: `${appUrl}/p/${profile.booking_slug}?status=success&hash=${hash}`,
        failure: `${appUrl}/p/${profile.booking_slug}?status=failure&hash=${hash}`,
        pending: `${appUrl}/p/${profile.booking_slug}?status=pending&hash=${hash}`,
      },
      auto_return: 'approved',
      notification_url: `${appUrl}/api/pagos/webhook?hash=${hash}`,
      metadata: { hash, booking: true },
      statement_descriptor: 'KLIA TURNO',
      expires: true,
      expiration_date_to: reserva.expira_at,
    }),
  })

  if (!prefRes.ok) {
    const errText = await prefRes.text()
    console.error('[booking/mp-preferencia] MP preference error:', errText)
    // La reserva sigue 'pendiente' — nada que persistir acá, el paciente
    // puede reintentar (nueva preferencia) hasta que expire.
    return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 502 })
  }

  const pref = await prefRes.json() as { id: string }

  return NextResponse.json({
    preference_id: pref.id,
    mp_public_key: profile.mp_public_key,
  })
}
