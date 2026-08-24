import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { enviarEmail } from '@/lib/brevo'
import { emailInvitacionColaboradora } from '@/lib/email-templates'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, nombre, apellido')
    .eq('id', user.id)
    .single()

  if (profile?.plan !== 'premium') {
    return NextResponse.json(
      { error: 'Necesitás el plan Premium para invitar colaboradoras' },
      { status: 403 },
    )
  }

  const { email, nombre } = await req.json() as { email?: string; nombre?: string }
  if (!email) {
    return NextResponse.json({ error: 'Falta email' }, { status: 400 })
  }

  const db = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { tipo_cuenta: 'colaborador', ...(nombre ? { nombre } : {}) },
      redirectTo: `${appUrl}/auth/callback?type=invite`,
    },
  })

  if (linkError) {
    const yaExiste = linkError.message.toLowerCase().includes('already registered')
      || linkError.message.toLowerCase().includes('already been registered')
      || linkError.message.toLowerCase().includes('already exists')
    if (yaExiste) {
      return NextResponse.json(
        { error: 'ya_tiene_cuenta', message: 'Este email ya tiene una cuenta en KLIA. Contactá a soporte para vincularlo.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Error al generar la invitación' }, { status: 500 })
  }

  const { error: insertError } = await db.from('colaboradores').insert({
    profesional_id: user.id,
    colaborador_id: linkData.user.id,
    invitacion_aceptada: false,
  })

  if (insertError) {
    console.error('[colaboradores/invitar] Error insertando colaborador:', insertError)
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'invitacion_duplicada', message: 'Ya invitaste a este email anteriormente.' },
        { status: 409 },
      )
    }
    try {
      await db.auth.admin.deleteUser(linkData.user.id)
    } catch (rollbackError) {
      console.error('[colaboradores/invitar] Rollback de auth.users también falló — requiere limpieza manual:', rollbackError)
    }
    return NextResponse.json(
      { error: 'error_vinculo', message: `La invitación se generó pero no pudimos vincularla a tu cuenta. Contactá a soporte con este email: ${email}` },
      { status: 500 },
    )
  }

  const nombreProfesional = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'Tu profesional'

  try {
    await enviarEmail({
      destinatario: email,
      nombreDestinatario: nombre ?? email,
      asunto: `${nombreProfesional} te invitó a colaborar en KLIA`,
      htmlContent: emailInvitacionColaboradora(nombreProfesional, nombre ?? null, linkData.properties.action_link),
    })
  } catch (emailError) {
    console.error('[colaboradores/invitar] Error enviando email:', emailError)
  }

  return NextResponse.json({ ok: true })
}
