import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailRecuperacionContrasena } from '@/lib/email-templates'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string }
    const { email } = body

    if (!email) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://app.klia.com.ar/auth/callback?type=recovery',
      },
    })

    if (error || !data?.properties?.action_link) {
      // Return ok regardless to avoid user enumeration
      return NextResponse.json({ ok: true })
    }

    const resetUrl = data.properties.action_link

    // Fetch the user's name for the email
    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users?.users?.find(u => u.email === email)
    const nombre: string = user?.user_metadata?.nombre || user?.user_metadata?.given_name || 'Profesional'

    await enviarEmail({
      destinatario: email,
      nombreDestinatario: nombre,
      asunto: 'Recuperá tu contraseña en KLIA',
      htmlContent: emailRecuperacionContrasena(nombre, resetUrl),
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
