import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { id, sphOd, cylOd, axisOd, addOd, avOd, sphOi, cylOi, axisOi, addOi, avOi } = body

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { data: receta, error: dbError } = await supabase
    .from('registros_refraccion')
    .update({
      sph_od: sphOd ?? null,
      cyl_od: cylOd ?? null,
      axis_od: axisOd ?? null,
      add_od: addOd ?? null,
      av_od: avOd || null,
      sph_oi: sphOi ?? null,
      cyl_oi: cylOi ?? null,
      axis_oi: axisOi ?? null,
      add_oi: addOi ?? null,
      av_oi: avOi || null,
    })
    .eq('id', id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .select()
    .single()

  if (dbError) {
    console.error('[refraccion/actualizar] DB error:', dbError)
    return NextResponse.json({ error: 'Error al actualizar la receta' }, { status: 500 })
  }

  return NextResponse.json({ receta })
}
