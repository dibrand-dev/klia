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

async function sendViaBrevoAPI(asunto: string, html: string, to: string, toName: string) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY no está configurada')

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'KLIA', email: 'hola@klia.com.ar' },
      to: [{ email: to, name: toName }],
      subject: asunto,
      htmlContent: html,
    }),
  })

  const body = await res.json().catch(() => ({ raw: res.statusText }))
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${JSON.stringify(body)}`)
  return body
}

export async function GET() {
  const nombre = 'Norberto'
  const email = 'norberto@dibrand.co'
  const apiKeyPresente = !!process.env.BREVO_API_KEY

  const templates = [
    { asunto: '[TEST 1/9] Confirmá tu cuenta en KLIA', html: emailConfirmacionCuenta(nombre, 'https://app.klia.com.ar') },
    { asunto: '[TEST 2/9] Bienvenido a KLIA', html: emailBienvenida(nombre, 21) },
    { asunto: '[TEST 3/9] Llevás una semana en KLIA', html: emailTrialDia7(nombre) },
    { asunto: '[TEST 4/9] Te quedan 7 días de prueba', html: emailTrialDia14(nombre) },
    { asunto: '[TEST 5/9] Te quedan 3 días de prueba', html: emailTrialPorVencer(nombre, 3) },
    { asunto: '[TEST 6/9] Mañana vence tu prueba', html: emailTrialDia20(nombre) },
    { asunto: '[TEST 7/9] Tu cuenta está pausada', html: emailCuentaBloqueada(nombre) },
    { asunto: '[TEST 8/9] Pago confirmado', html: emailPagoExitoso(nombre, 'Profesional', 'mensual', 28000, '15 de junio de 2026') },
    { asunto: '[TEST 9/9] No pudimos procesar tu pago', html: emailPagoFallido(nombre, 'Profesional') },
  ]

  const results = []
  for (const t of templates) {
    try {
      const resp = await sendViaBrevoAPI(t.asunto, t.html, email, nombre)
      results.push({ asunto: t.asunto, ok: true, messageId: resp.messageId })
    } catch (err) {
      results.push({ asunto: t.asunto, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    apiKeyPresente,
    results,
  })
}
