import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { planPerteneceATerapeuta } from '@/lib/nutricion/planes-alimentarios-ownership'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const { data: plan, error } = await db
    .from('planes_alimentarios')
    .select('*, plan_comidas(*, plan_comida_items(*))')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (error) {
    console.error('[planes-alimentarios/[id] GET] DB error:', error)
    return NextResponse.json({ error: 'Error al obtener el plan' }, { status: 500 })
  }
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  return NextResponse.json({ plan })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const perteneceAlTerapeuta = await planPerteneceATerapeuta(db, params.id, efectivo.terapeutaId)
  if (!perteneceAlTerapeuta) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const body = await request.json()
  const { nombre, estado, modo } = body

  const { data: plan, error } = await db
    .from('planes_alimentarios')
    .update({
      ...(nombre !== undefined ? { nombre } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(modo !== undefined ? { modo } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[planes-alimentarios/[id] PUT] DB error:', error)
    return NextResponse.json({ error: 'Error al editar el plan' }, { status: 500 })
  }

  return NextResponse.json({ plan })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const perteneceAlTerapeuta = await planPerteneceATerapeuta(db, params.id, efectivo.terapeutaId)
  if (!perteneceAlTerapeuta) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const { error } = await db
    .from('planes_alimentarios')
    .delete()
    .eq('id', params.id)

  if (error) {
    console.error('[planes-alimentarios/[id] DELETE] DB error:', error)
    return NextResponse.json({ error: 'Error al eliminar el plan' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
