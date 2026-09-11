import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { comidaConOwnership } from '@/lib/nutricion/planes-alimentarios-ownership'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const comida = await comidaConOwnership(db, params.id)
  if (!comida || comida.terapeutaId !== efectivo.terapeutaId) {
    return NextResponse.json({ error: 'Comida no encontrada' }, { status: 404 })
  }

  const body = await request.json()
  const { dia_semana: diaSemana, tipo_comida: tipoComida, orden } = body

  const { data: comidaActualizada, error } = await db
    .from('plan_comidas')
    .update({
      ...(diaSemana !== undefined ? { dia_semana: diaSemana } : {}),
      ...(tipoComida !== undefined ? { tipo_comida: tipoComida } : {}),
      ...(orden !== undefined ? { orden } : {}),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[plan-comidas/[id] PUT] DB error:', error)
    return NextResponse.json({ error: 'Error al editar la comida' }, { status: 500 })
  }

  return NextResponse.json({ comida: comidaActualizada })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const comida = await comidaConOwnership(db, params.id)
  if (!comida || comida.terapeutaId !== efectivo.terapeutaId) {
    return NextResponse.json({ error: 'Comida no encontrada' }, { status: 404 })
  }

  const { error } = await db
    .from('plan_comidas')
    .delete()
    .eq('id', params.id)

  if (error) {
    console.error('[plan-comidas/[id] DELETE] DB error:', error)
    return NextResponse.json({ error: 'Error al eliminar la comida' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
