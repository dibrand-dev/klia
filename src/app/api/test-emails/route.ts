export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import {
  emailConfirmacionCuenta,
  emailBienvenida,
  emailTrialDia7,
  emailTrialDia14,
  emailTrialPorVencer,
  emailTrialDia20,
  emailCuentaBloqueada,
  emailPagoExitoso,
  emailPagoFallido,
} from '@/lib/email-templates'

async function send(asunto: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY no configurada')
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'KLIA', email: 'hola@klia.com.ar' },
      to: [{ email: 'norberto@dibrand.co', name: 'Norberto' }],
      subject: asunto,
      htmlContent: html,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${JSON.stringify(body)}`)
  return body.messageId
}

export async function GET() {
  const n = 'Norberto'
  const templates = [
    { asunto: '[TEST 1/9] Confirmá tu cuenta', html: emailConfirmacionCuenta(n, 'https://app.klia.com.ar') },
    { asunto: '[TEST 2/9] Bienvenido a KLIA', html: emailBienvenida(n, 21) },
    { asunto: '[TEST 3/9] Llevás una semana en KLIA', html: emailTrialDia7(n) },
    { asunto: '[TEST 4/9] Te quedan 7 días de prueba', html: emailTrialDia14(n) },
    { asunto: '[TEST 5/9] Te quedan 3 días de prueba', html: emailTrialPorVencer(n, 3) },
    { asunto: '[TEST 6/9] Mañana vence tu prueba', html: emailTrialDia20(n) },
    { asunto: '[TEST 7/9] Tu cuenta está pausada', html: emailCuentaBloqueada(n) },
    { asunto: '[TEST 8/9] Pago confirmado', html: emailPagoExitoso(n, 'Profesional', 'mensual', 28000, '15 de junio de 2026') },
    { asunto: '[TEST 9/9] No pudimos procesar tu pago', html: emailPagoFallido(n, 'Profesional') },
  ]

  const results = []
  for (const t of templates) {
    try {
      const messageId = await send(t.asunto, t.html)
      results.push({ asunto: t.asunto, ok: true, messageId })
    } catch (err) {
      results.push({ asunto: t.asunto, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ success: results.every(r => r.ok), results })
}
