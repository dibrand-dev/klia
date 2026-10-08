import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { puedeUsarTiposTurno } from '@/lib/modulos'
import { validarTipoTurnoInput } from '@/lib/tipos-turno'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function obtenerPerfilEfectivo(db: ReturnType<typeof serviceClient>, terapeutaId: string) {
  const { data } = await db
    .from('profiles')
    .select('plan, terminologia')
    .eq('id', terapeutaId)
    .single()
  return data
}

// Sucursales activas del terapeuta efectivo — mismo helper que en
// src/app/api/tipos-turno/route.ts (POST), usado acá en PATCH.
async function obtenerSucursalesActivas(db: ReturnType<typeof serviceClient>, terapeutaId: string) {
  const { data } = await db
    .from('sucursales')
    .select('id')
    .eq('terapeuta_id', terapeutaId)
    .eq('activo', true)
  return (data ?? []).map((s) => s.id)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const perfil = await obtenerPerfilEfectivo(db, efectivo.terapeutaId)

  const habilitado = await puedeUsarTiposTurno(db, perfil?.plan ?? '')
  if (!habilitado) {
    return NextResponse.json(
      { error: 'Tu plan no incluye tipos de turno personalizados.' },
      { status: 403 },
    )
  }

  const { data: existente } = await db
    .from('tipos_turno')
    .select('id')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (!existente) return NextResponse.json({ error: 'Tipo de turno no encontrado' }, { status: 404 })

  const body = await req.json() as {
    nombre?: unknown; descripcion?: unknown; duracion_min?: unknown; precio?: unknown; moneda?: unknown
    visible_en_booking?: unknown; activo?: unknown; sucursal_ids?: unknown
  }
  const validado = validarTipoTurnoInput(body, perfil?.terminologia)
  if ('error' in validado) {
    return NextResponse.json({ error: validado.error }, { status: 400 })
  }

  // Misma regla que POST: 2+ sedes activas exige al menos una sede válida;
  // exactamente 1 sede activa se asigna sola; 0 sedes activas no asigna nada.
  const sucursalesActivas = await obtenerSucursalesActivas(db, efectivo.terapeutaId)
  const sucursalIdsInput = Array.isArray(body.sucursal_ids)
    ? body.sucursal_ids.filter((id): id is string => typeof id === 'string')
    : []

  let sucursalIds: string[]
  if (sucursalesActivas.length >= 2) {
    sucursalIds = sucursalIdsInput.filter((id) => sucursalesActivas.includes(id))
    if (sucursalIds.length === 0) {
      return NextResponse.json({ error: 'Elegí al menos una sede para poder guardar.' }, { status: 400 })
    }
  } else if (sucursalesActivas.length === 1) {
    sucursalIds = [sucursalesActivas[0]]
  } else {
    sucursalIds = []
  }

  const update: Record<string, unknown> = {
    nombre: validado.nombre,
    descripcion: validado.descripcion,
    duracion_min: validado.duracion_min,
    precio: validado.precio,
    moneda: validado.moneda,
    updated_at: new Date().toISOString(),
  }
  if (typeof body.visible_en_booking === 'boolean') update.visible_en_booking = body.visible_en_booking
  if (typeof body.activo === 'boolean') update.activo = body.activo

  const { data: actualizado, error } = await db
    .from('tipos_turno')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    // Mismo índice único que en POST — tampoco es parcial por `activo` acá.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya tenés un tipo con ese nombre (puede estar inactivo)' },
        { status: 409 },
      )
    }
    console.error('[api/tipos-turno/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Error al actualizar el tipo de turno' }, { status: 500 })
  }

  // Reemplazar el set de sedes (delete + insert) tras guardar el tipo —
  // acotado a las sedes ACTIVAS del terapeuta efectivo. Una sede desactivada
  // conserva su fila en tipos_turno_sucursales (solo se oculta/no cuenta),
  // así que nunca se borra acá; si se reactiva más adelante, la asignación
  // vuelve a aplicar tal cual había quedado.
  if (sucursalesActivas.length > 0) {
    await db.from('tipos_turno_sucursales').delete().eq('tipo_turno_id', params.id).in('sucursal_id', sucursalesActivas)
  }
  if (sucursalIds.length > 0) {
    const { error: sedesError } = await db
      .from('tipos_turno_sucursales')
      .insert(sucursalIds.map((sucursalId) => ({ tipo_turno_id: params.id, sucursal_id: sucursalId })))
    if (sedesError) {
      console.error('[api/tipos-turno/[id]] PATCH sedes error:', sedesError)
    }
  }

  return NextResponse.json({ tipo_turno: { ...actualizado, sucursal_ids: sucursalIds } })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const perfil = await obtenerPerfilEfectivo(db, efectivo.terapeutaId)

  const habilitado = await puedeUsarTiposTurno(db, perfil?.plan ?? '')
  if (!habilitado) {
    return NextResponse.json(
      { error: 'Tu plan no incluye tipos de turno personalizados.' },
      { status: 403 },
    )
  }

  const { data: existente } = await db
    .from('tipos_turno')
    .select('id')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (!existente) return NextResponse.json({ error: 'Tipo de turno no encontrado' }, { status: 404 })

  // Baja lógica únicamente — turnos.tipo_turno_id puede seguir referenciando
  // este id en turnos históricos o futuros ya agendados; borrarlo físicamente
  // los dejaría con una referencia rota.
  const { data: desactivado, error } = await db
    .from('tipos_turno')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    console.error('[api/tipos-turno/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Error al desactivar el tipo de turno' }, { status: 500 })
  }

  return NextResponse.json({ tipo_turno: desactivado })
}
