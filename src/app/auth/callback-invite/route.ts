import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('https://www.klia.com.ar/login?error=auth_callback_error'))
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    console.error('🔵 CALLBACK-INVITE error:', error?.message)
    return NextResponse.redirect(new URL('https://www.klia.com.ar/login?error=auth_callback_error'))
  }

  return NextResponse.redirect(new URL('/colaboradora/activar', origin))
}
