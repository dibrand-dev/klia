import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface BrevoEventPayload {
  event: string
  'message-id'?: string
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.BREVO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json() as BrevoEventPayload
  const messageId = payload['message-id']

  if (payload.event === 'opened' && messageId) {
    try {
      const supabase = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      await supabase
        .from('email_log')
        .update({ opened_at: new Date().toISOString() })
        .eq('brevo_message_id', messageId)
        .is('opened_at', null)
    } catch (err) {
      console.error('[webhooks/brevo-eventos] Error actualizando opened_at:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
