import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailConfirmacionCuenta } from '@/lib/email-templates'

export const runtime = 'nodejs'

// Reemplaza el email de confirmación de Supabase.
// Usa admin.generateLink para obtener el action_link (no disponible en el SDK cliente)
// y lo envía via Brevo en lugar del sistema nativo de Supabase.
// Requiere que los templates de Supabase estén vaciados en el dashboard.
export async function POST(req: NextRequest) {
  try {
    const { email, password, nombre, apellido, especialidad } = await req.json() as {
      email?: string
      password?: string
      nombre?: string
      apellido?: string
      especialidad?: string
    }

    if (!email || !password || !nombre || !apellido) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const origin = 'https://app.klia.com.ar'

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: { nombre, apellido, especialidad: especialidad ?? null },
        redirectTo: `${origin}/auth/callback`,
      },
    })

    if (error) {
      const yaRegistrado = error.message.toLowerCase().includes('already registered')
        || error.message.toLowerCase().includes('already been registered')
      return NextResponse.json(
        { error: yaRegistrado ? 'already_registered' : 'Error al crear la cuenta.' },
        { status: yaRegistrado ? 409 : 500 }
      )
    }

    const confirmationUrl = data.properties.action_link

    try {
      await enviarEmail({
        destinatario: email,
        nombreDestinatario: nombre,
        asunto: 'Confirmá tu cuenta en KLIA',
        htmlContent: emailConfirmacionCuenta(nombre, confirmationUrl),
      })
      console.log('Email enviado correctamente a:', email)
    } catch (emailError) {
      console.error('Error enviando email de confirmacion:', emailError)
      // Don't fail the registration if email fails
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en registro:', err)
    return NextResponse.json({ error: 'Error al crear la cuenta. Intentá de nuevo.' }, { status: 500 })
  }
}
