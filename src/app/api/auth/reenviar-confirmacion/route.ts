import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailConfirmacionCuenta } from '@/lib/email-templates'

export const runtime = 'nodejs'

// Reenvío del email de confirmación desde el login.
// Supabase solo devuelve "email_not_confirmed" cuando las credenciales son
// correctas, así que en ese punto el email+password recibidos son válidos.
// Replica el patrón de registro/route.ts: genera el action_link via admin SDK
// y lo envía con la plantilla branded de KLIA por Brevo (NO el email nativo
// de Supabase, que el proyecto no usa).
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as {
      email?: string
      password?: string
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: 'https://app.klia.com.ar/auth/callback?type=signup',
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[reenviar-confirmacion] error generando link:', linkError?.message)
      return NextResponse.json({ error: 'No se pudo generar el link de confirmación' }, { status: 500 })
    }

    const meta = (linkData.user?.user_metadata ?? {}) as { nombre?: string }
    const nombre = meta.nombre || email.split('@')[0]

    await enviarEmail({
      destinatario: email,
      nombreDestinatario: nombre,
      asunto: 'Confirmá tu cuenta en KLIA',
      htmlContent: emailConfirmacionCuenta(nombre, linkData.properties.action_link),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reenviar-confirmacion] excepcion:', err)
    return NextResponse.json({ error: 'Error al reenviar el email' }, { status: 500 })
  }
}
