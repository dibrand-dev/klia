import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const terapeutaId = searchParams.get('state')

  if (!code || !terapeutaId) {
    return NextResponse.redirect(`${appUrl}/ajustes?mp=error`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        code,
        redirect_uri: `${appUrl}/api/auth/mercadopago/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('MP token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${appUrl}/ajustes?mp=error`)
    }

    const tokenData = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      user_id: number
      expires_in: number
      public_key: string
    }

    // Get MP user info
    const userRes = await fetch(`https://api.mercadopago.com/users/${tokenData.user_id}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    const mpUser = userRes.ok ? await userRes.json() as { email: string; first_name: string; last_name: string } : null

    const expiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    const db = serviceClient()
    await db.from('profiles').update({
      mp_access_token: tokenData.access_token,
      mp_refresh_token: tokenData.refresh_token,
      mp_user_id: String(tokenData.user_id),
      mp_public_key: tokenData.public_key ?? null,
      mp_email: mpUser?.email ?? null,
      mp_nombre: mpUser ? `${mpUser.first_name} ${mpUser.last_name}`.trim() : null,
      mp_token_expiry: expiry,
    } as never).eq('id', terapeutaId)

    return NextResponse.redirect(`${appUrl}/ajustes?mp=connected&t=${Date.now()}`)
  } catch (err) {
    console.error('MP OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/ajustes?mp=error`)
  }
}
