import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await db
    .from('colaboradores')
    .update({ invitacion_aceptada: true })
    .eq('colaborador_id', user.id)
    .eq('activo', true)
    .select('id')

  if (error) {
    console.error('[colaboradores/activar] Error actualizando invitacion_aceptada:', error)
    return NextResponse.json({ error: 'No pudimos activar tu cuenta. Intentá de nuevo.' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'No se encontró una invitación pendiente para esta cuenta' },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true })
}
