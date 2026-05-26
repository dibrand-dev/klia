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

// Flujo:
// 1. admin.createUser — crea el usuario (dispara handle_new_user → INSERT profiles)
// 2. admin.generateLink type='signup' sobre el usuario ya creado — obtiene el action_link
//    sin volver a crear el usuario, solo genera el link de confirmación
// 3. Envía el link via Brevo en lugar del sistema nativo de Supabase
export async function POST(req: NextRequest) {
  console.log('🔵 REGISTRO: endpoint llamado')
  try {
    const body = await req.json() as {
      email?: string
      password?: string
      nombre?: string
      apellido?: string
      especialidad?: string
      matricula?: string
    }
    console.log('🔵 REGISTRO: datos recibidos:', { email: body.email, nombre: body.nombre, apellido: body.apellido })

    const { email, password, nombre, apellido, especialidad, matricula } = body

    if (!email || !password || !nombre || !apellido) {
      console.log('🔵 REGISTRO: faltan campos requeridos:', { email: !!email, password: !!password, nombre: !!nombre, apellido: !!apellido })
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400, headers: CORS_HEADERS })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Paso 1: Crear el usuario con admin.createUser (usa /admin/users, no /admin/generate_link)
    console.log('🔵 REGISTRO: creando usuario para:', email)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        nombre,
        apellido,
        ...(especialidad ? { especialidad } : {}),
        ...(matricula ? { matricula } : {}),
      },
      email_confirm: false,
    })

    if (createError) {
      console.log('🔵 REGISTRO: error en createUser:', createError.message)
      const yaRegistrado = createError.message.toLowerCase().includes('already registered')
        || createError.message.toLowerCase().includes('already been registered')
        || createError.message.toLowerCase().includes('already exists')
      return NextResponse.json(
        { error: yaRegistrado ? 'already_registered' : 'Error al crear la cuenta.' },
        { status: yaRegistrado ? 409 : 500, headers: CORS_HEADERS }
      )
    }

    console.log('🔵 REGISTRO: usuario creado:', userData.user.id)

    // Paso 2: Generar link de confirmación sobre el usuario ya existente
    console.log('🔵 REGISTRO: generando link de confirmación para:', email)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: 'https://app.klia.com.ar/auth/callback',
      },
    })

    if (linkError) {
      console.error('🔵 REGISTRO: error generando link (usuario creado igual):', linkError.message)
      // El usuario fue creado aunque no podamos mandar el link — retornar OK igual
      // El usuario puede usar "reenviar confirmación" desde login
      return NextResponse.json({ ok: true, warning: 'link_failed' }, { headers: CORS_HEADERS })
    }

    const confirmationUrl = linkData.properties.action_link
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
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('🔵 REGISTRO: excepcion no capturada:', err)
    return NextResponse.json({ error: 'Error al crear la cuenta. Intentá de nuevo.' }, { status: 500, headers: CORS_HEADERS })
  }
}
