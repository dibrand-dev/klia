import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailConfirmacionCuenta } from '@/lib/email-templates'

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.klia.com.ar',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Reemplaza el email de confirmación de Supabase.
// Usa admin.generateLink para obtener el action_link (no disponible en el SDK cliente)
// y lo envía via Brevo en lugar del sistema nativo de Supabase.
// Requiere que los templates de Supabase estén vaciados en el dashboard.
export async function POST(req: NextRequest) {
  console.log('🔵 REGISTRO: endpoint llamado')
  try {
    const body = await req.json() as {
      email?: string
      password?: string
      nombre?: string
      apellido?: string
      especialidad?: string
    }
    console.log('🔵 REGISTRO: datos recibidos:', { email: body.email, nombre: body.nombre })

    const { email, password, nombre, apellido, especialidad } = body

    if (!email || !password || !nombre || !apellido) {
      console.log('🔵 REGISTRO: faltan campos requeridos')
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('🔵 REGISTRO: llamando a generateLink para:', email)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: { nombre, apellido, especialidad: especialidad ?? null },
        redirectTo: 'https://app.klia.com.ar/auth/callback',
      },
    })

    if (error) {
      console.log('🔵 REGISTRO: error en generateLink:', error.message)
      const yaRegistrado = error.message.toLowerCase().includes('already registered')
        || error.message.toLowerCase().includes('already been registered')
      return NextResponse.json(
        { error: yaRegistrado ? 'already_registered' : 'Error al crear la cuenta.' },
        { status: yaRegistrado ? 409 : 500, headers: CORS_HEADERS }
      )
    }

    const confirmationUrl = data.properties.action_link
    console.log('🔵 REGISTRO: link generado, enviando email a:', email)

    try {
      await enviarEmail({
        destinatario: email,
        nombreDestinatario: nombre,
        asunto: 'Confirmá tu cuenta en KLIA',
        htmlContent: emailConfirmacionCuenta(nombre, confirmationUrl),
      })
      console.log('🔵 REGISTRO: email enviado correctamente')
    } catch (emailError) {
      console.error('🔵 REGISTRO: error enviando email:', emailError)
      // Don't fail the registration if email fails
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('🔵 REGISTRO: excepcion no capturada:', err)
    return NextResponse.json({ error: 'Error al crear la cuenta. Intentá de nuevo.' }, { status: 500, headers: CORS_HEADERS })
  }
}
