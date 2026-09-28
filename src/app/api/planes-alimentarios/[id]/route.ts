import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { planPerteneceATerapeuta } from '@/lib/nutricion/planes-alimentarios-ownership'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const { data: plan, error } = await db
    .from('planes_alimentarios')
    .select('*, plan_comidas(*, plan_comida_items(*))')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (error) {
    console.error('[planes-alimentarios/[id] GET] DB error:', error)
    return NextResponse.json({ error: 'Error al obtener el plan' }, { status: 500 })
  }
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  return NextResponse.json({ plan })
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const { data: planExistente } = await db
    .from('planes_alimentarios')
    .select('id, created_at')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()
  if (!planExistente) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const body = await request.json()
  const { nombre, estado, modo, objetivo_titulo: objetivoTitulo, objetivo_nota: objetivoNota, fecha_fin: fechaFin, indicaciones } = body

  if (objetivoTitulo !== undefined && objetivoTitulo !== null && String(objetivoTitulo).length > 60) {
    return NextResponse.json({ error: 'El objetivo del plan no puede superar los 60 caracteres' }, { status: 400 })
  }
  if (fechaFin !== undefined && fechaFin !== null) {
    const inicio = new Date(planExistente.created_at)
    const fin = new Date(`${fechaFin}T00:00:00`)
    if (Number.isNaN(fin.getTime())) {
      return NextResponse.json({ error: 'Fecha de fin inválida' }, { status: 400 })
    }
    if (fin < new Date(inicio.toISOString().slice(0, 10) + 'T00:00:00')) {
      return NextResponse.json({ error: 'La fecha de fin no puede ser anterior al inicio del plan' }, { status: 400 })
    }
  }

  let indicacionesTexto: string | null | undefined
  if (indicaciones !== undefined) {
    if (indicaciones === null) {
      indicacionesTexto = null
    } else {
      const lineas = String(indicaciones)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      const lineaLarga = lineas.find((l) => l.length > 90)
      if (lineaLarga) {
        return NextResponse.json({ error: 'Cada indicación no puede superar los 90 caracteres' }, { status: 400 })
      }
      indicacionesTexto = lineas.join('\n')
    }
  }

  const { data: plan, error } = await db
    .from('planes_alimentarios')
    .update({
      ...(nombre !== undefined ? { nombre } : {}),
      ...(estado !== undefined ? { estado } : {}),
      ...(modo !== undefined ? { modo } : {}),
      ...(objetivoTitulo !== undefined ? { objetivo_titulo: objetivoTitulo } : {}),
      ...(objetivoNota !== undefined ? { objetivo_nota: objetivoNota } : {}),
      ...(fechaFin !== undefined ? { fecha_fin: fechaFin } : {}),
      ...(indicacionesTexto !== undefined ? { indicaciones: indicacionesTexto } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[planes-alimentarios/[id] PUT] DB error:', error)
    return NextResponse.json({ error: 'Error al editar el plan' }, { status: 500 })
  }

  return NextResponse.json({ plan })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const perteneceAlTerapeuta = await planPerteneceATerapeuta(db, params.id, efectivo.terapeutaId)
  if (!perteneceAlTerapeuta) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const { error } = await db
    .from('planes_alimentarios')
    .delete()
    .eq('id', params.id)

  if (error) {
    console.error('[planes-alimentarios/[id] DELETE] DB error:', error)
    return NextResponse.json({ error: 'Error al eliminar el plan' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
