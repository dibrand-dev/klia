import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailConfirmacionCuenta } from '@/lib/email-templates'

export const runtime = 'nodejs'

// Genera un link de confirmación via admin SDK y lo envía por Brevo.
// Supabase no devuelve el action_link en el SDK de cliente, por eso se
// necesita el service role key server-side.
export async function POST(req: NextRequest) {
  try {
    const { email, nombre, confirmationUrl } = await req.json() as {
      email?: string
      nombre?: string
      confirmationUrl?: string
    }

    if (!email || !nombre || !confirmationUrl) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    await enviarEmail({
      destinatario: email,
      nombreDestinatario: nombre,
      asunto: 'Confirmá tu cuenta en KLIA',
      htmlContent: emailConfirmacionCuenta(nombre, confirmationUrl),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error enviando email de confirmación:', err)
    return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 })
  }
}
