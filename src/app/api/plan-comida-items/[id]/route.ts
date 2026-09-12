import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { itemConOwnership } from '@/lib/nutricion/planes-alimentarios-ownership'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const item = await itemConOwnership(db, params.id)
  if (!item || item.terapeutaId !== efectivo.terapeutaId) {
    return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
  }

  const body = await request.json()
  const {
    tipo,
    contenido_texto: contenidoTexto,
    alimento_fuente: alimentoFuente,
    alimento_id: alimentoId,
    cantidad_gramos: cantidadGramos,
    orden,
  } = body

  if (tipo !== undefined && tipo !== 'texto_libre' && tipo !== 'alimento') {
    return NextResponse.json({ error: "tipo debe ser 'texto_libre' o 'alimento'" }, { status: 400 })
  }

  if (tipo === 'alimento' && (!alimentoFuente || !alimentoId || cantidadGramos === undefined || cantidadGramos === null)) {
    return NextResponse.json(
      { error: 'Para tipo=alimento, alimento_fuente, alimento_id y cantidad_gramos son requeridos' },
      { status: 400 }
    )
  }
  if (tipo === 'texto_libre' && !contenidoTexto) {
    return NextResponse.json({ error: 'Para tipo=texto_libre, contenido_texto es requerido' }, { status: 400 })
  }

  const { data: itemActualizado, error } = await db
    .from('plan_comida_items')
    .update({
      ...(tipo !== undefined ? { tipo } : {}),
      ...(tipo === 'alimento' ? { contenido_texto: null, alimento_fuente: alimentoFuente, alimento_id: alimentoId, cantidad_gramos: cantidadGramos } : {}),
      ...(tipo === 'texto_libre' ? { contenido_texto: contenidoTexto, alimento_fuente: null, alimento_id: null, cantidad_gramos: null } : {}),
      ...(orden !== undefined ? { orden } : {}),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[plan-comida-items/[id] PUT] DB error:', error)
    return NextResponse.json({ error: 'Error al editar el item' }, { status: 500 })
  }

  return NextResponse.json({ item: itemActualizado })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const item = await itemConOwnership(db, params.id)
  if (!item || item.terapeutaId !== efectivo.terapeutaId) {
    return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
  }

  const { error } = await db
    .from('plan_comida_items')
    .delete()
    .eq('id', params.id)

  if (error) {
    console.error('[plan-comida-items/[id] DELETE] DB error:', error)
    return NextResponse.json({ error: 'Error al eliminar el item' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
