import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/agenda'

  if (code) {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Setear campos de trial si aún no fueron inicializados
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_fin')
        .eq('id', user.id)
        .single()

      if (!profile?.trial_fin) {
        const now = new Date()
        const trialFin = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
        await supabase.from('profiles').update({
          plan: 'premium',
          estado_cuenta: 'trial',
          trial_inicio: now.toISOString(),
          trial_fin: trialFin.toISOString(),
        }).eq('id', user.id)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
