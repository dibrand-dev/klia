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

// Lee el plan y la terminología del profesional dueño (efectivo.terapeutaId),
// nunca del usuario logueado — si es Colaboradora, manda el plan/terminología
// de su profesional.
async function obtenerPerfilEfectivo(db: ReturnType<typeof serviceClient>, terapeutaId: string) {
  const { data } = await db
    .from('profiles')
    .select('plan, terminologia')
    .eq('id', terapeutaId)
    .single()
  return data
}

// Sucursales activas del terapeuta efectivo — usado para validar sucursal_ids
// en POST/PATCH y para asignar automáticamente cuando hay exactamente 1.
async function obtenerSucursalesActivas(db: ReturnType<typeof serviceClient>, terapeutaId: string) {
  const { data } = await db
    .from('sucursales')
    .select('id')
    .eq('terapeuta_id', terapeutaId)
    .eq('activo', true)
  return (data ?? []).map((s) => s.id)
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const perfil = await obtenerPerfilEfectivo(db, efectivo.terapeutaId)

  const habilitado = await puedeUsarTiposTurno(db, perfil?.plan ?? '')

  const soloActivos = req.nextUrl.searchParams.get('activos') === '1'

  let query = db
    .from('tipos_turno')
    .select('*')
    .eq('terapeuta_id', efectivo.terapeutaId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })

  if (soloActivos) query = query.eq('activo', true)

  const { data: tipos, error } = await query

  if (error) {
    console.error('[api/tipos-turno] GET error:', error)
    return NextResponse.json({ error: 'Error al obtener los tipos de turno' }, { status: 500 })
  }

  const tipoIds = (tipos ?? []).map((t) => t.id)
  const sucursalIdsPorTipo: Record<string, string[]> = {}
  if (tipoIds.length > 0) {
    const { data: asignaciones } = await db
      .from('tipos_turno_sucursales')
      .select('tipo_turno_id, sucursal_id')
      .in('tipo_turno_id', tipoIds)
    for (const a of asignaciones ?? []) {
      (sucursalIdsPorTipo[a.tipo_turno_id] ??= []).push(a.sucursal_id)
    }
  }
  const tiposConSedes = (tipos ?? []).map((t) => ({ ...t, sucursal_ids: sucursalIdsPorTipo[t.id] ?? [] }))

  // GET no es un 403 — si el plan no lo permite, Ajustes igual necesita ver
  // los tipos ya creados (ej. un downgrade de Premium a Esencial) para
  // mostrarlos en solo lectura, con el flag `habilitado` indicando que no se
  // pueden crear/editar/borrar más desde acá.
  return NextResponse.json({ tipos_turno: tiposConSedes, habilitado })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const perfil = await obtenerPerfilEfectivo(db, efectivo.terapeutaId)

  const habilitado = await puedeUsarTiposTurno(db, perfil?.plan ?? '')
  if (!habilitado) {
    return NextResponse.json(
      { error: 'Tu plan no incluye tipos de turno personalizados. Actualizá tu plan para crear los tuyos.' },
      { status: 403 },
    )
  }

  const body = await req.json() as {
    nombre?: unknown; descripcion?: unknown; duracion_min?: unknown; precio?: unknown; moneda?: unknown
    visible_en_booking?: unknown; activo?: unknown; sucursal_ids?: unknown
  }
  const validado = validarTipoTurnoInput(body, perfil?.terminologia)
  if ('error' in validado) {
    return NextResponse.json({ error: validado.error }, { status: 400 })
  }

  // Sedes — misma regla en toda la feature: 2+ sedes activas exige al menos
  // una sede válida; exactamente 1 sede activa se asigna sola, sin importar
  // lo que venga en el body; 0 sedes activas no asigna nada (no hay nada que
  // filtrar).
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

  const { data: nuevo, error } = await db
    .from('tipos_turno')
    .insert({
      terapeuta_id: efectivo.terapeutaId,
      nombre: validado.nombre,
      descripcion: validado.descripcion,
      duracion_min: validado.duracion_min,
      precio: validado.precio,
      moneda: validado.moneda,
      visible_en_booking: typeof body.visible_en_booking === 'boolean' ? body.visible_en_booking : true,
      activo: typeof body.activo === 'boolean' ? body.activo : true,
    })
    .select('*')
    .single()

  if (error) {
    // Índice único tipos_turno_terapeuta_nombre_uq (terapeuta_id,
    // lower(btrim(nombre))) — no es parcial por `activo`, así que un tipo
    // dado de baja (activo=false) sigue bloqueando el nombre.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya tenés un tipo con ese nombre (puede estar inactivo)' },
        { status: 409 },
      )
    }
    console.error('[api/tipos-turno] POST error:', error)
    return NextResponse.json({ error: 'Error al crear el tipo de turno' }, { status: 500 })
  }

  if (sucursalIds.length > 0) {
    const { error: sedesError } = await db
      .from('tipos_turno_sucursales')
      .insert(sucursalIds.map((sucursalId) => ({ tipo_turno_id: nuevo.id, sucursal_id: sucursalId })))
    if (sedesError) {
      console.error('[api/tipos-turno] POST sedes error:', sedesError)
    }
  }

  return NextResponse.json({ tipo_turno: { ...nuevo, sucursal_ids: sucursalIds } })
}
