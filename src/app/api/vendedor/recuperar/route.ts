import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailRecuperacionContrasena } from '@/lib/email-templates'
import { resolverBaseUrl } from '@/lib/urls'

export const runtime = 'nodejs'

// Mismo mecanismo que /api/auth/recuperar (generateLink type='recovery' +
// Brevo) — separado en su propio endpoint porque es un flujo de cuenta
// distinto (Acceso Comercial), aunque la mecánica sea idéntica. Nunca revela
// si el email existe o no: siempre responde ok.
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
        redirectTo: `${resolverBaseUrl(req)}/auth/callback?type=recovery`,
      },
    })

    if (error || !data?.properties?.action_link) {
      // Responde ok igual, para evitar enumeración de usuarios.
      return NextResponse.json({ ok: true })
    }

    const resetUrl = data.properties.action_link

    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users?.users?.find(u => u.email === email)
    const nombre: string = user?.user_metadata?.nombre || 'Vendedor/a'

    await enviarEmail({
      destinatario: email,
      nombreDestinatario: nombre,
      asunto: 'Recuperá tu contraseña — Acceso Comercial KLIA',
      htmlContent: emailRecuperacionContrasena(nombre, resetUrl),
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
