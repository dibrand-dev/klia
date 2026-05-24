import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (!code) {
    return NextResponse.redirect(new URL('https://www.klia.com.ar/login?error=auth_callback_error'))
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    console.error('🔵 CALLBACK error:', error?.message)
    return NextResponse.redirect(new URL('https://www.klia.com.ar/login?error=auth_callback_error'))
  }

  // Handle password recovery
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/nueva-contrasena', origin))
  }

  const session = data.session

  // Check if admin
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', session.user.email ?? '')
    .eq('activo', true)
    .maybeSingle()

  if (adminUser) {
    return NextResponse.redirect(new URL('/ops/dashboard', origin))
  }

  // Check if new user
  const { data: profile } = await supabase
    .from('profiles')
    .select('trial_fin, nombre, apellido, avatar_url')
    .eq('id', session.user.id)
    .single()

  if (!profile?.trial_fin) {
    const trialFin = new Date()
    trialFin.setDate(trialFin.getDate() + 21)

    const meta = session.user.user_metadata ?? {}
    const firstName = profile?.nombre || meta.given_name || (meta.full_name ?? meta.name ?? '').split(' ')[0] || ''
    const lastName = profile?.apellido || meta.family_name || (meta.full_name ?? meta.name ?? '').split(' ').slice(1).join(' ') || ''
    const avatarUrl = profile?.avatar_url || meta.avatar_url || meta.picture || null

    await supabase.from('profiles').update({
      nombre: firstName,
      apellido: lastName,
      ...(avatarUrl && { avatar_url: avatarUrl }),
      plan: 'premium',
      estado_cuenta: 'trial',
      trial_inicio: new Date().toISOString(),
      trial_fin: trialFin.toISOString(),
    }).eq('id', session.user.id)

    fetch(`${origin}/api/emails/bienvenida`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id }),
    }).catch(() => {})

    return NextResponse.redirect(new URL('/bienvenida', origin))
  }

  return NextResponse.redirect(new URL('/dashboard', origin))
}
