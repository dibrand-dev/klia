import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedClient, obtenerEventosGoogle } from '@/lib/google-calendar'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ eventosConHora: [], eventosDiaCompleto: [] })

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ eventosConHora: [], eventosDiaCompleto: [] })

  const { data: tokens } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('terapeuta_id', efectivo.terapeutaId)
    .eq('sync_enabled', true)
    .single()

  if (!tokens) return NextResponse.json({ eventosConHora: [], eventosDiaCompleto: [] })

  try {
    const calendarClient = await getAuthenticatedClient(tokens, efectivo.terapeutaId)
    const { eventosConHora, eventosDiaCompleto } = await obtenerEventosGoogle(
      calendarClient,
      new Date(start),
      new Date(end),
      tokens.calendar_id || 'primary',
    )
    return NextResponse.json({
      eventosConHora: eventosConHora.map((e) => ({
        ...e,
        inicio: e.inicio.toISOString(),
        fin: e.fin.toISOString(),
      })),
      eventosDiaCompleto,
    })
  } catch {
    return NextResponse.json({ eventosConHora: [], eventosDiaCompleto: [] })
  }
}
