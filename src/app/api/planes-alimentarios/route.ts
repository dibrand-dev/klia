import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const pacienteId = request.nextUrl.searchParams.get('paciente_id')
  if (!pacienteId) return NextResponse.json({ error: 'paciente_id requerido' }, { status: 400 })

  const db = serviceClient()

  const { data: paciente } = await db
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const { data: planes, error } = await db
    .from('planes_alimentarios')
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[planes-alimentarios GET] DB error:', error)
    return NextResponse.json({ error: 'Error al listar planes' }, { status: 500 })
  }

  return NextResponse.json({ planes })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { paciente_id: pacienteId, nombre, estado, modo } = body

  if (!pacienteId || !nombre) {
    return NextResponse.json({ error: 'paciente_id y nombre requeridos' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: paciente } = await db
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const { data: plan, error } = await db
    .from('planes_alimentarios')
    .insert({
      terapeuta_id: efectivo.terapeutaId,
      paciente_id: pacienteId,
      nombre,
      estado: estado ?? 'activo',
      modo: modo ?? 'simple',
    })
    .select()
    .single()

  if (error) {
    console.error('[planes-alimentarios POST] DB error:', error)
    return NextResponse.json({ error: 'Error al crear el plan' }, { status: 500 })
  }

  return NextResponse.json({ plan })
}
