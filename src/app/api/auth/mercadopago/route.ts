import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/login`)

  const params = new URLSearchParams({
    client_id: process.env.MP_CLIENT_ID!,
    response_type: 'code',
    platform_id: 'mp',
    redirect_uri: `${appUrl}/api/auth/mercadopago/callback`,
    state: user.id,
  })

  return NextResponse.redirect(
    `https://auth.mercadopago.com.ar/authorization?${params.toString()}`
  )
}
