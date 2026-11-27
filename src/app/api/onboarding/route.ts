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

  // Fase 3 matrículas (Ajustes v3): profiles.matricula ya no se escribe
  // directo desde este endpoint — lo sincroniza trg_sync_matricula_principal
  // a partir de profesional_matriculas (migración 024, ya aplicada en
  // klia-staging). Se saca de `updates` antes del update a profiles para no
  // pisar el valor que el trigger ya sincronizó.
  const matriculaOnboarding = updates.matricula
  if ('matricula' in updates) delete updates.matricula

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Nunca borra filas de profesional_matriculas, y nunca pisa una matrícula
  // ya verificada por REFEPS: si el profesional tiene alguna fila
  // verificada, este paso de onboarding no toca nada. Un valor vacío se
  // ignora en vez de limpiar la fila existente.
  if (typeof matriculaOnboarding === 'string' && matriculaOnboarding.trim()) {
    const numero = matriculaOnboarding.trim()
    const { data: existentes } = await supabase
      .from('profesional_matriculas')
      .select('id, es_principal, verificada')
      .eq('profesional_id', user.id)

    const tieneVerificada = (existentes ?? []).some((m) => m.verificada)
    if (!tieneVerificada) {
      const principal = (existentes ?? []).find((m) => m.es_principal)
      if (principal) {
        await supabase.from('profesional_matriculas').update({ numero }).eq('id', principal.id)
      } else {
        // Sin ninguna fila todavía — se inserta manual, no verificada; el
        // trigger la marca principal por ser la primera.
        await supabase.from('profesional_matriculas').insert({
          profesional_id: user.id,
          numero,
          origen: 'manual',
          verificada: false,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
