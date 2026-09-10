import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { overlapsOf, horaFinValida, type Bloque } from '@/lib/sedes/horarios'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  const { data: sede } = await db
    .from('sucursales')
    .select('id')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()
  if (!sede) return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })

  const { data: horarios, error } = await db
    .from('horarios_sucursal')
    .select('*')
    .eq('sucursal_id', params.id)
    .order('dia_semana', { ascending: true })

  if (error) {
    console.error('[api/sedes/[id]/horarios] GET error:', error)
    return NextResponse.json({ error: 'Error al obtener los horarios' }, { status: 500 })
  }

  return NextResponse.json({ horarios: horarios ?? [] })
}

// Reemplaza todos los bloques de la sede (insert-only tras un delete completo).
// No es un jsonb: cada bloque es una fila real en horarios_sucursal.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    dias?: Array<{ dia_semana: number; bloques: Bloque[] }>
  }
  const dias = body.dias ?? []

  for (const dia of dias) {
    if (dia.dia_semana < 0 || dia.dia_semana > 6) {
      return NextResponse.json({ error: 'dia_semana inválido' }, { status: 400 })
    }
    if (dia.bloques.some(b => !horaFinValida(b))) {
      return NextResponse.json({ error: 'Un bloque no puede tener la misma hora de inicio y fin' }, { status: 400 })
    }
    if (overlapsOf(dia.bloques).size > 0) {
      return NextResponse.json({ error: 'solapamiento', dia_semana: dia.dia_semana }, { status: 400 })
    }
  }

  const db = serviceClient()

  const { data: sede } = await db
    .from('sucursales')
    .select('id')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()
  if (!sede) return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })

  const { error: delError } = await db.from('horarios_sucursal').delete().eq('sucursal_id', params.id)
  if (delError) {
    console.error('[api/sedes/[id]/horarios] delete error:', delError)
    return NextResponse.json({ error: 'Error al guardar los horarios' }, { status: 500 })
  }

  const filas = dias.flatMap(dia => dia.bloques.map(b => ({
    sucursal_id: params.id,
    terapeuta_id: efectivo.terapeutaId,
    dia_semana: dia.dia_semana,
    hora_inicio: b[0],
    hora_fin: b[1],
  })))

  if (filas.length > 0) {
    const { data: insertadas, error: insError } = await db.from('horarios_sucursal').insert(filas).select('*')
    if (insError) {
      console.error('[api/sedes/[id]/horarios] insert error:', insError)
      return NextResponse.json({ error: 'Error al guardar los horarios' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, data: insertadas ?? [] })
  }

  return NextResponse.json({ ok: true, data: [] })
}
