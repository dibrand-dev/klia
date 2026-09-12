import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { comidaConOwnership } from '@/lib/nutricion/planes-alimentarios-ownership'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const comida = await comidaConOwnership(db, params.id)
  if (!comida || comida.terapeutaId !== efectivo.terapeutaId) {
    return NextResponse.json({ error: 'Comida no encontrada' }, { status: 404 })
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

  if (tipo !== 'texto_libre' && tipo !== 'alimento') {
    return NextResponse.json({ error: "tipo debe ser 'texto_libre' o 'alimento'" }, { status: 400 })
  }

  // Coherente con el constraint chk_item_coherente de la tabla — replicado acá
  // para devolver un error legible antes de que la DB rechace el insert.
  if (tipo === 'alimento') {
    if (!alimentoFuente || !alimentoId || cantidadGramos === undefined || cantidadGramos === null) {
      return NextResponse.json(
        { error: 'Para tipo=alimento, alimento_fuente, alimento_id y cantidad_gramos son requeridos' },
        { status: 400 }
      )
    }
  } else if (!contenidoTexto) {
    return NextResponse.json({ error: 'Para tipo=texto_libre, contenido_texto es requerido' }, { status: 400 })
  }

  const { data: item, error } = await db
    .from('plan_comida_items')
    .insert({
      comida_id: params.id,
      terapeuta_id: efectivo.terapeutaId,
      tipo,
      contenido_texto: tipo === 'texto_libre' ? contenidoTexto : null,
      alimento_fuente: tipo === 'alimento' ? alimentoFuente : null,
      alimento_id: tipo === 'alimento' ? alimentoId : null,
      cantidad_gramos: tipo === 'alimento' ? cantidadGramos : null,
      orden: orden ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[plan-comidas/[id]/items POST] DB error:', error)
    return NextResponse.json({ error: 'Error al agregar el item' }, { status: 500 })
  }

  return NextResponse.json({ item })
}
