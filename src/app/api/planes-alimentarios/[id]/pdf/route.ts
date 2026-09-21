import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { calcularMacrosPlan } from '@/lib/planes-alimentarios/macros'
import { generarPdfPlanAlimentario } from '@/lib/planillas/plan-alimentario'
import type { ComidaPlan, ItemComida } from '@/lib/planillas/plan-alimentario'
import { formatNombreCompleto } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ItemRow = {
  id: string
  tipo: string
  contenido_texto: string | null
  alimento_fuente: string | null
  alimento_id: string | null
  cantidad_gramos: number | null
}

type ComidaRow = {
  id: string
  dia_semana: string
  tipo_comida: string
  hora: string | null
  nota: string | null
  plan_comida_items: ItemRow[]
}

// Mismo patrón que "Se mostrará como" en AjustesClient.tsx (perfilForm.matricula_tipo).
function formatMatricula(tipo: string | null, matricula: string | null, provincia: string | null): string {
  if (!matricula) return ''
  if (tipo === 'provincial') return `MP ${matricula}${provincia ? ` (${provincia})` : ''}`
  if (tipo === 'nacional') return `MN ${matricula}`
  return matricula
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const [{ data: plan }, { data: profile }] = await Promise.all([
    db
      .from('planes_alimentarios')
      .select('*, plan_comidas(id, dia_semana, tipo_comida, hora, nota, plan_comida_items(*))')
      .eq('id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .maybeSingle(),
    db
      .from('profiles')
      .select('nombre, apellido, especialidad, matricula, matricula_tipo, matricula_provincia, telefono, email, firma_sello_url, avatar_url')
      .eq('id', efectivo.terapeutaId)
      .single(),
  ])

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (!profile) return NextResponse.json({ error: 'Perfil del profesional no encontrado' }, { status: 404 })

  const { data: paciente } = await db
    .from('pacientes')
    .select('nombre, apellido')
    .eq('id', plan.paciente_id)
    .single()

  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const [{ data: distribucion }, macros, { data: turnosFuturos }] = await Promise.all([
    db
      .from('distribucion_macros')
      .select('porcentaje_carbohidratos, porcentaje_proteinas, porcentaje_grasas, kcal_objetivo')
      .eq('paciente_id', plan.paciente_id)
      .maybeSingle(),
    calcularMacrosPlan(db, params.id, efectivo.terapeutaId),
    db
      .from('turnos')
      .select('fecha_hora, modalidad, sucursal_id, estado')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('paciente_id', plan.paciente_id)
      .gte('fecha_hora', new Date().toISOString())
      .order('fecha_hora', { ascending: true }),
  ])

  // Mismo criterio de "próximo turno" que la ficha del paciente
  // (src/app/(dashboard)/pacientes/[id]/page.tsx): primer turno futuro que no
  // esté cancelado ni marcado como no_asistio.
  const proximoTurnoRow = (turnosFuturos ?? []).find((t) => t.estado !== 'cancelado' && t.estado !== 'no_asistio') ?? null

  let direccionSede: string | null = null
  if (proximoTurnoRow?.sucursal_id) {
    const { data: sucursal } = await db
      .from('sucursales')
      .select('direccion')
      .eq('id', proximoTurnoRow.sucursal_id)
      .maybeSingle()
    direccionSede = sucursal?.direccion ?? null
  }

  const comidasRaw = (plan.plan_comidas ?? []) as unknown as ComidaRow[]

  // Nombres de alimentos del Vademécum para los ítems tipo 'alimento'
  // (plan_comida_items no guarda el nombre directo — ver diagnóstico previo).
  const alimentoIds = new Set<string>()
  for (const comida of comidasRaw) {
    for (const item of comida.plan_comida_items ?? []) {
      if (item.tipo === 'alimento' && item.alimento_id) alimentoIds.add(String(item.alimento_id))
    }
  }
  const nombrePorAlimentoId = new Map<string, string>()
  if (alimentoIds.size > 0) {
    const { data: alimentos } = await db
      .from('vademecum_alimentos')
      .select('id, nombre')
      .in('id', Array.from(alimentoIds))
    for (const a of alimentos ?? []) nombrePorAlimentoId.set(String(a.id), a.nombre)
  }

  const comidas: ComidaPlan[] = comidasRaw.map((comida) => {
    const items: ItemComida[] = (comida.plan_comida_items ?? []).map((item) => {
      const nombre = item.tipo === 'alimento' && item.alimento_id
        ? (nombrePorAlimentoId.get(String(item.alimento_id)) ?? 'Alimento sin nombre cargado')
        : (item.contenido_texto ?? '')
      return { tipo: item.tipo, nombre, cantidadGramos: item.cantidad_gramos }
    })
    return {
      diaSemana: comida.dia_semana,
      tipoComida: comida.tipo_comida,
      hora: comida.hora,
      nota: comida.nota,
      items,
    }
  })

  const kcalPorDia: Record<string, number> = {}
  for (const d of macros?.porDiaAgregado ?? []) {
    kcalPorDia[d.diaSemana] = d.totales.energia
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPdfPlanAlimentario({
      pacienteNombreCompleto: formatNombreCompleto(paciente.nombre, paciente.apellido),
      profesionalNombreCorto: formatNombreCompleto(profile.nombre, profile.apellido),
      especialidad: profile.especialidad ?? '',
      matricula: formatMatricula(profile.matricula_tipo, profile.matricula, profile.matricula_provincia),
      telefono: profile.telefono,
      email: profile.email,
      firmaSelloUrl: profile.firma_sello_url,
      avatarUrl: profile.avatar_url,
      objetivoTitulo: plan.objetivo_titulo,
      objetivoNota: plan.objetivo_nota,
      kcalObjetivo: distribucion?.kcal_objetivo ?? null,
      porcentajeCarbohidratos: distribucion?.porcentaje_carbohidratos ?? 45,
      porcentajeProteinas: distribucion?.porcentaje_proteinas ?? 30,
      porcentajeGrasas: distribucion?.porcentaje_grasas ?? 25,
      indicaciones: (plan.indicaciones ?? '').split('\n').map((s: string) => s.trim()).filter(Boolean),
      fechaPreparacion: plan.created_at,
      fechaFin: plan.fecha_fin,
      proximoTurno: proximoTurnoRow ? {
        fechaHora: proximoTurnoRow.fecha_hora,
        modalidad: proximoTurnoRow.modalidad,
        direccionSede,
      } : null,
      comidas,
      kcalPorDia,
    })
  } catch (err) {
    console.error('[planes-alimentarios/[id]/pdf] PDF generation failed:', err)
    return NextResponse.json(
      { error: 'Error al generar el PDF', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  const filename = `Plan_Alimentario_${paciente.apellido}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
