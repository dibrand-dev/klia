import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, data } = body as {
    action: 'skip' | 'complete' | 'step'
    data?: Record<string, unknown>
  }

  let updates: Record<string, unknown> = {}

  if (action === 'skip') {
    updates = { onboarding_skipped: true }
  } else if (action === 'complete') {
    updates = { onboarding_completed: true, ...(data ?? {}) }
  } else if (action === 'step') {
    updates = data ?? {}
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fase 3 matrículas (Ajustes v3): este endpoint sigue siendo la única
  // escritura de "matricula" durante el onboarding, directo a profiles —
  // nunca pasaba por profesional_matriculas. Sin esto, un profesional
  // recién registrado queda con profiles.matricula cargado pero cero filas
  // en profesional_matriculas, invisible para la pantalla nueva de
  // matrícula. "Fila sin tipo" = la matrícula legacy, sin distinguir
  // provincial/nacional (onboarding no pide esa distinción) — se busca por
  // tipo/provincia nulos, nunca por número, porque el usuario puede volver
  // a este paso y cambiar el número antes de avanzar.
  if ('matricula' in updates) {
    const { data: existentes } = await supabase
      .from('profesional_matriculas')
      .select('id, tipo, provincia')
      .eq('profesional_id', user.id)
    const filaSinTipo = (existentes ?? []).find((m) => !m.tipo && !m.provincia)

    if (typeof updates.matricula === 'string' && updates.matricula.trim()) {
      const numero = updates.matricula.trim()
      if (filaSinTipo) {
        await supabase.from('profesional_matriculas').update({ numero }).eq('id', filaSinTipo.id)
      } else {
        await supabase.from('profesional_matriculas').insert({
          profesional_id: user.id,
          numero,
          origen: 'manual',
          verificada: false,
        })
      }
    } else if (filaSinTipo) {
      await supabase.from('profesional_matriculas').delete().eq('id', filaSinTipo.id)
    }
  }

  return NextResponse.json({ ok: true })
}
