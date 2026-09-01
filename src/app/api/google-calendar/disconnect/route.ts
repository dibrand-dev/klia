import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { oauth2Client } from '@/lib/google-calendar'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export async function DELETE() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: tokens } = await supabase
    .from('google_calendar_tokens')
    .select('access_token')
    .eq('terapeuta_id', efectivo.terapeutaId)
    .single()

  if (tokens?.access_token) {
    try {
      await oauth2Client.revokeToken(tokens.access_token)
    } catch {
      // Continuar aunque la revocación falle
    }
  }

  await supabase.from('google_calendar_tokens').delete().eq('terapeuta_id', efectivo.terapeutaId)

  return NextResponse.json({ ok: true })
}
