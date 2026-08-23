import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { sync_enabled } = await req.json() as { sync_enabled: boolean }

  const { error } = await supabase
    .from('google_calendar_tokens')
    .update({ sync_enabled, updated_at: new Date().toISOString() })
    .eq('terapeuta_id', efectivo.terapeutaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, sync_enabled })
}
