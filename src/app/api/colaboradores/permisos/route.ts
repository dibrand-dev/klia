import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

// Actualiza ve_cobros de una colaboradora puntual — filtra por id además de
// profesional_id, así ninguna colaboradora puede modificar el permiso de otra
// fila que no sea de su propio profesional.
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { colaboradorId, ve_cobros } = await req.json() as { colaboradorId?: string; ve_cobros?: boolean }
  if (!colaboradorId || typeof ve_cobros !== 'boolean') {
    return NextResponse.json({ error: 'Faltan colaboradorId o ve_cobros' }, { status: 400 })
  }

  const db = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await db
    .from('colaboradores')
    .update({ ve_cobros })
    .eq('id', colaboradorId)
    .eq('profesional_id', user.id)

  if (error) {
    console.error('[colaboradores/permisos] Error:', error)
    return NextResponse.json({ error: 'Error al actualizar el permiso' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
