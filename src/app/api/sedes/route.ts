import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { PALETTE, limiteSedes } from '@/lib/sedes/horarios'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { data: sedes, error } = await db
    .from('sucursales')
    .select('*')
    .eq('terapeuta_id', efectivo.terapeutaId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[api/sedes] GET error:', error)
    return NextResponse.json({ error: 'Error al obtener sedes' }, { status: 500 })
  }

  const lista = sedes ?? []
  const { data: turnosConSede } = await db
    .from('turnos')
    .select('sucursal_id')
    .eq('terapeuta_id', efectivo.terapeutaId)
    .not('sucursal_id', 'is', null)

  const idsConTurnos = new Set((turnosConSede ?? []).map(t => t.sucursal_id))
  const sedesConTurnos = lista.map(s => ({ ...s, tieneTurnos: idsConTurnos.has(s.id) }))

  return NextResponse.json({ sedes: sedesConTurnos })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    nombre?: string
    direccion?: string | null
    es_online?: boolean
    color?: string
  }

  const nombre = (body.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'El nombre de la sede es obligatorio' }, { status: 400 })

  const color = body.color ?? PALETTE[0].c
  if (!PALETTE.some(p => p.c === color)) {
    return NextResponse.json({ error: 'Color inválido' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: profile } = await db
    .from('profiles')
    .select('plan')
    .eq('id', efectivo.terapeutaId)
    .single()

  const { data: existentes, count } = await db
    .from('sucursales')
    .select('id, color, orden', { count: 'exact' })
    .eq('terapeuta_id', efectivo.terapeutaId)

  const limite = limiteSedes(profile?.plan)
  if ((count ?? 0) >= limite) {
    return NextResponse.json({ error: 'limite_alcanzado', limite }, { status: 403 })
  }

  if ((existentes ?? []).some(s => s.color === color)) {
    return NextResponse.json({ error: 'Ese color ya está en uso por otra sede' }, { status: 400 })
  }

  const orden = Math.max(0, ...(existentes ?? []).map(s => s.orden)) + 1

  const { data: nueva, error } = await db
    .from('sucursales')
    .insert({
      terapeuta_id: efectivo.terapeutaId,
      nombre,
      direccion: body.es_online ? null : (body.direccion?.trim() || null),
      es_online: body.es_online ?? false,
      color,
      orden,
    })
    .select('*')
    .single()

  if (error || !nueva) {
    console.error('[api/sedes] POST error:', error)
    return NextResponse.json({ error: 'Error al crear la sede' }, { status: 500 })
  }

  return NextResponse.json({ sede: nueva })
}
