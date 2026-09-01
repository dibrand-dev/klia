import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { pacienteId, turnoId, sphOd, cylOd, axisOd, addOd, avOd, sphOi, cylOi, axisOi, addOi, avOi } = body

  if (!pacienteId) return NextResponse.json({ error: 'pacienteId requerido' }, { status: 400 })

  const { data: paciente } = await supabase
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .single()

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const { data: receta, error: dbError } = await supabase
    .from('registros_refraccion')
    .insert({
      paciente_id: pacienteId,
      terapeuta_id: efectivo.terapeutaId,
      turno_id: turnoId || null,
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
    .select()
    .single()

  if (dbError) {
    console.error('[refraccion/crear] DB error:', dbError)
    return NextResponse.json({ error: 'Error al guardar la receta' }, { status: 500 })
  }

  return NextResponse.json({ receta })
}
