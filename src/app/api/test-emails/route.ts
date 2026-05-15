import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
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

  const emails = [
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
  for (const e of emails) {
    await enviarEmail({
      destinatario: email,
      nombreDestinatario: nombre,
      asunto: e.asunto,
      htmlContent: e.html,
    })
    results.push({ asunto: e.asunto, enviado: true })
  }

  return NextResponse.json({ success: true, enviados: results })
}
