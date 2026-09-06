import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { oauth2Client } from '@/lib/google-calendar'
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
    return NextResponse.redirect(`${appUrl}/ajustes/integraciones?google=error`)
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${appUrl}/ajustes/integraciones?google=error`)
    }

    const db = serviceClient()
    const { error: upsertError } = await db.from('google_calendar_tokens').upsert(
      {
        terapeuta_id: terapeutaId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(tokens.expiry_date ?? Date.now() + 3600000).toISOString(),
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'terapeuta_id' },
    )

    if (upsertError) {
      console.error('🔴 GCAL TOKEN UPSERT FAILED:', upsertError.message)
      return NextResponse.redirect(`${appUrl}/ajustes/integraciones?google=error`)
    }

    return NextResponse.redirect(`${appUrl}/ajustes/integraciones?google=connected&t=${Date.now()}`)
  } catch {
    return NextResponse.redirect(`${appUrl}/ajustes/integraciones?google=error`)
  }
}
