import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { sincronizarTurnoCreado } from '@/lib/sync-google-calendar'

export async function POST() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: turnos, error } = await supabase
    .from('turnos')
    .select('id')
    .eq('terapeuta_id', efectivo.terapeutaId)
    .is('google_event_id', null)
    .gte('fecha_hora', new Date().toISOString())
    .not('estado', 'in', '("cancelado")')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sincronizados = 0
  for (const t of turnos ?? []) {
    try {
      await sincronizarTurnoCreado(t.id, efectivo.terapeutaId)
      sincronizados++
    } catch {
      // continuar con el resto aunque uno falle
    }
  }

  return NextResponse.json({ ok: true, total: turnos?.length ?? 0, sincronizados })
}
