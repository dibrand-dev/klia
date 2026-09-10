import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { PALETTE } from '@/lib/sedes/horarios'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    nombre?: string
    direccion?: string | null
    es_online?: boolean
    color?: string
    activo?: boolean
  }

  const db = serviceClient()

  const { data: sede } = await db
    .from('sucursales')
    .select('id, color')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (!sede) return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })

  const update: Record<string, unknown> = {}

  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim()
    if (!nombre) return NextResponse.json({ error: 'El nombre de la sede es obligatorio' }, { status: 400 })
    update.nombre = nombre
  }
  if (body.es_online !== undefined) update.es_online = body.es_online
  if (body.direccion !== undefined || body.es_online !== undefined) {
    update.direccion = (update.es_online ?? body.es_online) ? null : (body.direccion?.trim() || null)
  }
  if (body.activo !== undefined) update.activo = body.activo
  if (body.color !== undefined && body.color !== sede.color) {
    if (!PALETTE.some(p => p.c === body.color)) {
      return NextResponse.json({ error: 'Color inválido' }, { status: 400 })
    }
    const { data: otras } = await db
      .from('sucursales')
      .select('id')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('color', body.color)
      .neq('id', params.id)
    if ((otras ?? []).length > 0) {
      return NextResponse.json({ error: 'Ese color ya está en uso por otra sede' }, { status: 400 })
    }
    update.color = body.color
  }

  const { data: actualizada, error } = await db
    .from('sucursales')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error || !actualizada) {
    console.error('[api/sedes/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Error al actualizar la sede' }, { status: 500 })
  }

  return NextResponse.json({ sede: actualizada })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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

  // No permitir borrar una sede con turnos históricos: turnos.sucursal_id no
  // tiene ON DELETE CASCADE hacia sucursales, pero cobros.turno_id sí lo tiene
  // hacia turnos — si algún día se decide borrar turnos huérfanos de una sede
  // eliminada, ese borrado se llevaría sus cobros sin aviso. Se evita yendo un
  // paso antes: la sede con historial no se puede eliminar, solo desactivar.
  const { count, error: countError } = await db
    .from('turnos')
    .select('id', { count: 'exact', head: true })
    .eq('sucursal_id', params.id)

  if (countError) {
    console.error('[api/sedes/[id]] DELETE count error:', countError)
    return NextResponse.json({ error: 'Error al verificar turnos de la sede' }, { status: 500 })
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'tiene_turnos', count }, { status: 409 })
  }

  const { error } = await db.from('sucursales').delete().eq('id', params.id)

  if (error) {
    console.error('[api/sedes/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Error al eliminar la sede' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
