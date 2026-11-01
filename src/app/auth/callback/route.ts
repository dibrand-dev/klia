import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (!code) {
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/nueva-contrasena', 'https://app.klia.com.ar'))
    }
    if (type === 'signup') {
      return NextResponse.redirect(new URL('/auth/confirm', 'https://app.klia.com.ar'))
    }
    return NextResponse.redirect(new URL('https://www.klia.com.ar/login?error=auth_callback_error'))
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    console.error('🔵 CALLBACK error:', error?.message)
    return NextResponse.redirect(new URL('https://www.klia.com.ar/login?error=auth_callback_error'))
  }

  // Handle password recovery. app_metadata (nunca user_metadata — el usuario
  // la puede editar desde el cliente con auth.updateUser) distingue si la
  // cuenta es del portal del paciente para mandarla a su propia pantalla de
  // nueva contraseña — cualquier otro caso mantiene el destino de siempre.
  if (type === 'recovery') {
    const destino = data.session.user.app_metadata?.tipo_cuenta === 'paciente' ? '/portal/nueva-contrasena' : '/nueva-contrasena'
    return NextResponse.redirect(new URL(destino, origin))
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
    .select('trial_fin, nombre, apellido, avatar_url, tipo_cuenta, plan, estado_cuenta')
    .eq('id', session.user.id)
    .single()

  // Cuenta del portal del paciente: nunca tiene fila en profiles, por diseño.
  // En el flujo normal de invitación no pasa por acá — eso lo maneja
  // /portal/activar del lado del cliente leyendo el hash de la URL, igual
  // que colaboradora — esto es defensivo para cuando una sesión de paciente
  // termina en este callback compartido (ej. el mismo fallback de
  // generateLink que ya intercepta middleware.ts). Sin este chequeo, con
  // !profile el código de abajo la trataba como "profesional nuevo": pisaba
  // plan/estado_cuenta con un UPDATE que no tocaba ninguna fila, mandaba el
  // mail de bienvenida de profesional y redirigía a /bienvenida.
  if (!profile && session.user.user_metadata?.tipo_cuenta === 'paciente') {
    return NextResponse.redirect(new URL('/portal', origin))
  }

  if (!profile?.trial_fin && profile?.tipo_cuenta === 'colaborador') {
    return NextResponse.redirect(new URL('/dashboard', origin))
  }

  // Cuentas bonificadas o ya activas (pagando) pueden tener trial_fin nulo
  // (otorgadas directo desde OPS, sin pasar nunca por el trial) — nunca hay
  // que tratarlas como "usuario nuevo" y pisarles plan/estado_cuenta a trial.
  const esBonificadaOActiva = profile?.plan === 'bonificado' || profile?.estado_cuenta === 'activa'

  if (!profile?.trial_fin && !esBonificadaOActiva) {
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

  const { error: resetFlagError } = await supabase
    .from('profiles')
    .update({ email_inactividad_enviado_at: null })
    .eq('id', session.user.id)
  if (resetFlagError) {
    console.error('🔵 CALLBACK error reseteando email_inactividad_enviado_at:', resetFlagError.message)
  }

  return NextResponse.redirect(new URL('/dashboard', origin))
}
