import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: colaborador, error: fetchError } = await db
    .from('colaboradores')
    .select('id, profesional_id, colaborador_id, invitacion_aceptada')
    .eq('id', params.id)
    .single()

  if (fetchError || !colaborador) {
    return NextResponse.json({ error: 'Colaboradora no encontrada' }, { status: 404 })
  }

  if (colaborador.profesional_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (colaborador.invitacion_aceptada) {
    return NextResponse.json(
      { error: 'ya_activa', message: 'Ya activó su cuenta, no se puede eliminar la invitación' },
      { status: 400 },
    )
  }

  try {
    await db.auth.admin.deleteUser(colaborador.colaborador_id)
  } catch (deleteError) {
    console.error('[colaboradores/eliminar-invitacion] Error eliminando usuario huérfano:', deleteError)
  }

  const { error: deleteRowError } = await db.from('colaboradores').delete().eq('id', colaborador.id)
  if (deleteRowError) {
    console.error('[colaboradores/eliminar-invitacion] Error eliminando fila:', deleteRowError)
    return NextResponse.json({ error: 'Error al eliminar la invitación' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
