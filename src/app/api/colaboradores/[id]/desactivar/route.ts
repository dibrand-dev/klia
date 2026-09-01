import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: colaborador, error: fetchError } = await db
    .from('colaboradores')
    .select('id, profesional_id')
    .eq('id', params.id)
    .single()

  if (fetchError || !colaborador) {
    return NextResponse.json({ error: 'Colaboradora no encontrada' }, { status: 404 })
  }

  if (colaborador.profesional_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { error: updateError } = await db
    .from('colaboradores')
    .update({ activo: false })
    .eq('id', params.id)

  if (updateError) {
    console.error('[colaboradores/desactivar] Error:', updateError)
    return NextResponse.json({ error: 'Error al desactivar la colaboradora' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
