export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/brevo'
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

export async function GET() {
  const nombre = 'Norberto'
  const email = 'norberto@dibrand.co'

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
      await enviarEmail({
        destinatario: email,
        nombreDestinatario: nombre,
        asunto: t.asunto,
        htmlContent: t.html,
      })
      results.push({ asunto: t.asunto, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ asunto: t.asunto, ok: false, error: msg })
    }
  }

  const anyFailed = results.some(r => !r.ok)
  return NextResponse.json({ success: !anyFailed, enviados: results }, { status: anyFailed ? 500 : 200 })
}
