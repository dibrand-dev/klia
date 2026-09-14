import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type Accion = 'activar' | 'archivar' | 'desarchivar'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const accion = body.accion as Accion
  if (!['activar', 'archivar', 'desarchivar'].includes(accion)) {
    return NextResponse.json({ error: 'accion inválida' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: planActual } = await db
    .from('planes_alimentarios')
    .select('id, paciente_id, estado')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (!planActual) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  if (accion === 'activar') {
    if (planActual.estado === 'activo') {
      return NextResponse.json({ plan: planActual })
    }
    const { error: demoteError } = await db
      .from('planes_alimentarios')
      .update({ estado: 'pasado', updated_at: new Date().toISOString() })
      .eq('paciente_id', planActual.paciente_id)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('estado', 'activo')

    if (demoteError) {
      console.error('[planes-alimentarios/[id]/estado] Error al demover el plan activo:', demoteError)
      return NextResponse.json({ error: 'Error al cambiar el estado del plan' }, { status: 500 })
    }

    const { data: plan, error } = await db
      .from('planes_alimentarios')
      .update({ estado: 'activo', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('[planes-alimentarios/[id]/estado] Error al activar:', error)
      return NextResponse.json({ error: 'Error al cambiar el estado del plan' }, { status: 500 })
    }

    return NextResponse.json({ plan })
  }

  if (accion === 'archivar') {
    if (planActual.estado === 'activo') {
      return NextResponse.json({ error: 'El plan vigente no se puede archivar. Marcá otro como vigente primero.' }, { status: 400 })
    }
    const { data: plan, error } = await db
      .from('planes_alimentarios')
      .update({ estado: 'archivado', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('[planes-alimentarios/[id]/estado] Error al archivar:', error)
      return NextResponse.json({ error: 'Error al cambiar el estado del plan' }, { status: 500 })
    }

    return NextResponse.json({ plan })
  }

  // desarchivar — nunca vuelve directo a 'activo', queda como 'pasado'.
  const { data: plan, error } = await db
    .from('planes_alimentarios')
    .update({ estado: 'pasado', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[planes-alimentarios/[id]/estado] Error al desarchivar:', error)
    return NextResponse.json({ error: 'Error al cambiar el estado del plan' }, { status: 500 })
  }

  return NextResponse.json({ plan })
}
