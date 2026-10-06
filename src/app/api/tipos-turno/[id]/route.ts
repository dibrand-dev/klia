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

  const body = await req.json()
  const validado = validarTipoTurnoInput(body, perfil?.terminologia)
  if ('error' in validado) {
    return NextResponse.json({ error: validado.error }, { status: 400 })
  }

  const { data: actualizado, error } = await db
    .from('tipos_turno')
    .update({
      nombre: validado.nombre,
      duracion_min: validado.duracion_min,
      precio: validado.precio,
      moneda: validado.moneda,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    // Mismo índice único que en POST — tampoco es parcial por `activo` acá.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya tenés un tipo de turno con ese nombre — incluso si lo desactivaste, el nombre sigue reservado' },
        { status: 409 },
      )
    }
    console.error('[api/tipos-turno/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Error al actualizar el tipo de turno' }, { status: 500 })
  }

  return NextResponse.json({ tipo_turno: actualizado })
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
