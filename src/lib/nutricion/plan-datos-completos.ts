// Arma el mismo objeto DatosPlanAlimentario que usa el generador de PDF
// (src/lib/planillas/plan-alimentario.ts) — extraído de
// src/app/api/planes-alimentarios/[id]/pdf/route.ts para que la página
// pública (src/app/p/[token]/page.tsx) muestre el plan VIVO con los mismos
// datos, sin duplicar la lógica de armado.
import { calcularMacrosPlan } from '@/lib/planes-alimentarios/macros'
import { serviceClient } from '@/lib/supabase/service'
import type { ComidaPlan, ItemComida, DatosPlanAlimentario } from '@/lib/planillas/plan-alimentario'
import { formatNombreCompleto } from '@/lib/utils'

type Db = ReturnType<typeof serviceClient>

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

/**
 * terapeutaId debe venir de una fuente ya verificada (getEffectiveTerapeutaIdServer
 * en el flujo del profesional, o el propio plan_compartidos.terapeuta_id — nunca de
 * paciente_id/plan_id sueltos del request) — esta función no vuelve a validar ownership.
 */
export async function obtenerDatosPlanAlimentario(
  db: Db,
  planId: string,
  terapeutaId: string,
): Promise<DatosPlanAlimentario | null> {
  const [{ data: plan }, { data: profile }] = await Promise.all([
    db
      .from('planes_alimentarios')
      .select('*, plan_comidas(id, dia_semana, tipo_comida, hora, nota, plan_comida_items(*))')
      .eq('id', planId)
      .eq('terapeuta_id', terapeutaId)
      .maybeSingle(),
    db
      .from('profiles')
      .select('nombre, apellido, especialidad, matricula, matricula_tipo, matricula_provincia, telefono, email, firma_sello_url, avatar_url')
      .eq('id', terapeutaId)
      .single(),
  ])

  if (!plan || !profile) return null

  const { data: paciente } = await db
    .from('pacientes')
    .select('nombre, apellido')
    .eq('id', plan.paciente_id)
    .single()

  if (!paciente) return null

  const [{ data: distribucion }, macros, { data: turnosFuturos }] = await Promise.all([
    db
      .from('distribucion_macros')
      .select('porcentaje_carbohidratos, porcentaje_proteinas, porcentaje_grasas, kcal_objetivo')
      .eq('paciente_id', plan.paciente_id)
      .maybeSingle(),
    calcularMacrosPlan(db, planId, terapeutaId),
    db
      .from('turnos')
      .select('fecha_hora, modalidad, sucursal_id, estado')
      .eq('terapeuta_id', terapeutaId)
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
  // (plan_comida_items no guarda el nombre directo).
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

  return {
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
  }
}
