import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { planPerteneceATerapeuta } from '@/lib/nutricion/planes-alimentarios-ownership'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const perteneceAlTerapeuta = await planPerteneceATerapeuta(db, params.id, efectivo.terapeutaId)
  if (!perteneceAlTerapeuta) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const body = await request.json()
  const { dia_semana: diaSemana, tipo_comida: tipoComida, orden } = body

  if (diaSemana === undefined || diaSemana === null || !tipoComida) {
    return NextResponse.json({ error: 'dia_semana y tipo_comida requeridos' }, { status: 400 })
  }

  const { data: comida, error } = await db
    .from('plan_comidas')
    .insert({
      plan_id: params.id,
      dia_semana: diaSemana,
      tipo_comida: tipoComida,
      orden: orden ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[planes-alimentarios/[id]/comidas POST] DB error:', error)
    return NextResponse.json({
      error: 'Error al agregar la comida',
      debug: {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    }, { status: 500 })
  }

  return NextResponse.json({ comida })
}
