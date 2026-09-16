import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const COMIDAS_VALIDAS = ['desayuno', 'colacion1', 'almuerzo', 'colacion2', 'merienda', 'cena'] as const
type ComidaKey = typeof COMIDAS_VALIDAS[number]

async function pacientePerteneceATerapeuta(
  db: ReturnType<typeof serviceClient>,
  pacienteId: string,
  terapeutaId: string,
): Promise<boolean> {
  const { data } = await db
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('terapeuta_id', terapeutaId)
    .maybeSingle()
  return !!data
}

export async function GET(request: NextRequest, { params }: { params: { pacienteId: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const pertenece = await pacientePerteneceATerapeuta(db, params.pacienteId, efectivo.terapeutaId)
  if (!pertenece) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const [{ data: comidas, error: errorComidas }, { data: generales, error: errorGenerales }] = await Promise.all([
    db.from('habitos_comidas').select('*').eq('paciente_id', params.pacienteId),
    db.from('habitos_generales').select('*').eq('paciente_id', params.pacienteId).maybeSingle(),
  ])

  if (errorComidas || errorGenerales) {
    console.error('[habitos GET] DB error:', errorComidas ?? errorGenerales)
    return NextResponse.json({ error: 'Error al obtener los hábitos' }, { status: 500 })
  }

  return NextResponse.json({ comidas: comidas ?? [], generales: generales ?? null })
}

export async function PUT(request: NextRequest, { params }: { params: { pacienteId: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const pertenece = await pacientePerteneceATerapeuta(db, params.pacienteId, efectivo.terapeutaId)
  if (!pertenece) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const body = await request.json()
  const comidasBody = (body.comidas ?? []) as Array<{
    comida: string
    hora_semana?: string | null
    hora_finde?: string | null
    descripcion?: string | null
  }>
  const generalesBody = body.generales as {
    actividad_fisica?: boolean | null
    actividad_frecuencia_dias?: number | null
    actividad_tipo?: string | null
    agua_cantidad?: number | null
    agua_unidad?: string | null
    sueno_horas?: number | null
    gaseosas_frecuencia?: string | null
    alcohol_frecuencia?: string | null
    tabaco?: boolean | null
    tabaco_cantidad?: number | null
    drogas_consumo?: string | null
    drogas_detalle?: string | null
    notas_generales?: string | null
  } | undefined

  for (const c of comidasBody) {
    if (!COMIDAS_VALIDAS.includes(c.comida as ComidaKey)) {
      return NextResponse.json({ error: `comida inválida: ${c.comida}` }, { status: 400 })
    }
  }

  const filasComidas = comidasBody.map((c) => ({
    paciente_id: params.pacienteId,
    terapeuta_id: efectivo.terapeutaId,
    comida: c.comida,
    hora_semana: c.hora_semana || null,
    hora_finde: c.hora_finde || null,
    descripcion: c.descripcion || null,
  }))

  if (filasComidas.length > 0) {
    const { error: errorComidas } = await db
      .from('habitos_comidas')
      .upsert(filasComidas, { onConflict: 'paciente_id,comida' })
    if (errorComidas) {
      console.error('[habitos PUT] Error al guardar habitos_comidas:', errorComidas)
      return NextResponse.json({ error: 'Error al guardar los hábitos' }, { status: 500 })
    }
  }

  if (generalesBody) {
    const { error: errorGenerales } = await db
      .from('habitos_generales')
      .upsert({
        paciente_id: params.pacienteId,
        terapeuta_id: efectivo.terapeutaId,
        actividad_fisica: generalesBody.actividad_fisica ?? null,
        actividad_frecuencia_dias: generalesBody.actividad_frecuencia_dias ?? null,
        actividad_tipo: generalesBody.actividad_tipo || null,
        agua_cantidad: generalesBody.agua_cantidad ?? null,
        agua_unidad: generalesBody.agua_unidad || null,
        sueno_horas: generalesBody.sueno_horas ?? null,
        gaseosas_frecuencia: generalesBody.gaseosas_frecuencia || null,
        alcohol_frecuencia: generalesBody.alcohol_frecuencia || null,
        tabaco: generalesBody.tabaco ?? null,
        tabaco_cantidad: generalesBody.tabaco_cantidad ?? null,
        drogas_consumo: generalesBody.drogas_consumo || null,
        drogas_detalle: generalesBody.drogas_detalle || null,
        notas_generales: generalesBody.notas_generales || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'paciente_id' })
    if (errorGenerales) {
      console.error('[habitos PUT] Error al guardar habitos_generales:', errorGenerales)
      return NextResponse.json({ error: 'Error al guardar los hábitos' }, { status: 500 })
    }
  }

  const [{ data: comidas }, { data: generales }] = await Promise.all([
    db.from('habitos_comidas').select('*').eq('paciente_id', params.pacienteId),
    db.from('habitos_generales').select('*').eq('paciente_id', params.pacienteId).maybeSingle(),
  ])

  return NextResponse.json({ comidas: comidas ?? [], generales: generales ?? null })
}
