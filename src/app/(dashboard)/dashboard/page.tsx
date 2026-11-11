import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'
import type { Profile, PacienteColaboradorRow } from '@/types/database'
import type { DashboardResumen, SerieMensualMes } from '@/types/dashboard'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { getModulosConfig, puedeAcceder } from '@/lib/modulos'
import {
  resolverPeriodo, resolverComparacion, PRESET_LABELS,
  type PeriodoPreset,
} from '@/lib/dashboard/periodo'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard — KLIA' }

const PRESETS: PeriodoPreset[] = ['hoy', 'semana', 'mes', 'mesant', '3m', 'anio']

type PeriodoTurnoRaw = {
  id: string; fecha_hora: string; estado: string; monto: number | null; moneda: string | null
  pagado: boolean; estado_pago: string | null; monto_pagado: number | null; paciente_id: string
  paciente: unknown
}
type DeudaGlobal = { totalCount: number; porMoneda: Record<string, { total: number; count: number }>; top: { pacienteId: string; nombre: string; apellido: string; saldo: number; moneda: string; n: number; masAntigua: string }[] }
type OsSinLiquidarGlobal = { totalCount: number; porMoneda: Record<string, number>; meses: { mesKey: string; filas: { osNombre: string; n: number; monto: number; moneda: string }[] }[] }

// PostgREST corta en 1000 filas por request: pagina hasta traer todo.
async function fetchTodos<T>(
  q: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<{ data: T[] }> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; from < 50 * PAGE; from += PAGE) {
    const { data } = await q(from, from + PAGE - 1)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return { data: out }
}

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const mapaPacientesColaborador = new Map<string, { nombre: string; apellido: string; os_config_id: string | null; activo: boolean; telefono: string | null }>()
  let todosPacientesColaborador: PacienteColaboradorRow[] = []
  if (efectivo.esColaborador) {
    const { data: todosPacientesRaw } = await supabase.rpc('get_pacientes_colaborador')
    todosPacientesColaborador = (todosPacientesRaw ?? []) as PacienteColaboradorRow[]
    for (const p of todosPacientesColaborador) {
      mapaPacientesColaborador.set(p.id, { nombre: p.nombre, apellido: p.apellido, os_config_id: p.os_config_id, activo: p.activo, telefono: p.telefono })
    }
  }
  const resolverPaciente = (pacienteId: string, embebido: { nombre: string; apellido: string; os_config_id: string | null } | null) =>
    efectivo.esColaborador
      ? (mapaPacientesColaborador.get(pacienteId) ?? null)
      : embebido

  // Argentina = UTC-3 (sin horario de verano)
  const ahora = new Date()
  const hoyArg = new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
  const hoyArgStr = hoyArg.toISOString().slice(0, 10)

  const presetParam = Array.isArray(searchParams.p) ? searchParams.p[0] : searchParams.p
  const cmpParam = Array.isArray(searchParams.cmp) ? searchParams.cmp[0] : searchParams.cmp
  const desdeParam = Array.isArray(searchParams.desde) ? searchParams.desde[0] : searchParams.desde
  const hastaParam = Array.isArray(searchParams.hasta) ? searchParams.hasta[0] : searchParams.hasta

  const preset: PeriodoPreset = presetParam === 'custom' && desdeParam && hastaParam
    ? 'custom'
    : (PRESETS as string[]).includes(presetParam ?? '') ? (presetParam as PeriodoPreset) : 'mes'
  const cmpTipo: 'prev' | 'yoy' = cmpParam === 'yoy' ? 'yoy' : 'prev'

  const periodo = resolverPeriodo(preset, hoyArgStr, desdeParam, hastaParam)
  const comparacion = resolverComparacion(cmpTipo, preset, periodo, hoyArgStr)

  // Rangos para las queries directas que siguen usando timestamps (no las
  // RPC, que ya reciben `date` puro) — mismo patrón UTC-3 de siempre.
  const inicioHoyUTC = new Date(`${hoyArgStr}T03:00:00.000Z`)
  const finHoyUTC = new Date(inicioHoyUTC.getTime() + 24 * 60 * 60 * 1000)
  const inicioPeriodoUTC = new Date(`${periodo.desde}T03:00:00.000Z`)
  const finPeriodoUTC = new Date(new Date(`${periodo.hasta}T03:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
  const treintaDiasStr = new Date(hoyArg.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: profile },
    modulos,
    { data: resumenRaw },
    { data: serieMensualRaw },
    { data: turnosHoy },
    { data: entrevistasHoy },
    { data: periodoTurnosRaw },
    { data: sinVenirRaw },
    { data: deudaRaw },
    { data: osSinLiquidarRaw },
    { data: seriesVencen },
    { data: obrasSociales },
  ] = await Promise.all([
    supabase.from('profiles').select('nombre, plan').eq('id', efectivo.terapeutaId).single(),
    getModulosConfig(supabase),

    supabase.rpc('dashboard_resumen', {
      p_desde: periodo.desde, p_hasta: periodo.hasta,
      p_cmp_desde: comparacion.desde, p_cmp_hasta: comparacion.hasta,
    }),
    supabase.rpc('dashboard_serie_mensual', { p_hasta: periodo.hasta, p_meses: 6 }),

    supabase
      .from('turnos')
      .select('id, fecha_hora, estado, paciente_id, paciente:pacientes(nombre, apellido)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .gte('fecha_hora', inicioHoyUTC.toISOString())
      .lt('fecha_hora', finHoyUTC.toISOString())
      .neq('estado', 'cancelado')
      .order('fecha_hora'),

    supabase
      .from('entrevistas')
      .select('id, nombre, apellido, hora, estado')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('fecha', hoyArgStr)
      .neq('estado', 'cancelada'),

    fetchTodos<PeriodoTurnoRaw>((from, to) => supabase
      .from('turnos')
      .select('id, fecha_hora, estado, monto, moneda, pagado, estado_pago, monto_pagado, paciente_id, paciente:pacientes(nombre, apellido, os_config_id)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .gte('fecha_hora', inicioPeriodoUTC.toISOString())
      .lt('fecha_hora', finPeriodoUTC.toISOString())
      .order('fecha_hora').order('id')
      .range(from, to)),

    supabase.rpc('dashboard_sin_venir'),
    supabase.rpc('dashboard_deuda'),
    supabase.rpc('dashboard_os_sin_liquidar'),

    supabase
      .from('turnos_recurrentes')
      .select('id, fecha_fin, paciente_id, paciente:pacientes(nombre, apellido)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('activo', true)
      .lte('fecha_fin', treintaDiasStr)
      .order('fecha_fin'),

    supabase
      .from('profesional_obras_sociales')
      .select('id, nombre')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('activa', true),
  ])

  let nombreTerapeuta = (profile as Profile | null)?.nombre ?? ''
  const plan = (profile as Profile | null)?.plan ?? ''
  if (efectivo.esColaborador) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: perfilPropio } = await supabase.from('profiles').select('nombre').eq('id', user.id).single()
      if (perfilPropio?.nombre) nombreTerapeuta = perfilPropio.nombre
    }
  }

  const osMap: Record<string, string> = {}
  for (const os of obrasSociales ?? []) osMap[os.id] = os.nombre

  const resumen = (resumenRaw ?? null) as DashboardResumen | null
  const serieMensual = (serieMensualRaw ?? []) as SerieMensualMes[]

  // Esencial nunca ve montos aunque la RPC los devuelva (gate de plan,
  // independiente del ve_cobros de colaboradora que ya resuelve la RPC).
  const planPermiteCobros = puedeAcceder('cobros', plan, modulos)
  const veCobros = planPermiteCobros && !!resumen?.ve_cobros

  const hoy = {
    turnos: (turnosHoy ?? []).map((t) => ({
      id: t.id,
      pacienteId: t.paciente_id,
      fecha_hora: t.fecha_hora,
      estado: t.estado,
      paciente: resolverPaciente(t.paciente_id, t.paciente as unknown as { nombre: string; apellido: string; os_config_id: string | null } | null),
    })),
    entrevistas: (entrevistasHoy ?? []).map((e) => ({
      id: e.id, nombre: e.nombre, apellido: e.apellido, hora: e.hora, estado: e.estado,
    })),
  }

  const periodoTurnos = (periodoTurnosRaw ?? []).map((t) => {
    const paciente = resolverPaciente(t.paciente_id, t.paciente as unknown as { nombre: string; apellido: string; os_config_id: string | null } | null)
    return {
      id: t.id,
      pacienteId: t.paciente_id,
      fecha_hora: t.fecha_hora,
      estado: t.estado,
      // Sin permiso de cobros los montos nunca viajan al cliente (el
      // payload RSC es visible aunque la UI los oculte).
      monto: veCobros ? t.monto : null,
      moneda: t.moneda ?? 'ARS',
      pagado: veCobros ? t.pagado : false,
      montoPagado: veCobros ? (t.monto_pagado ?? 0) : 0,
      origen: paciente?.os_config_id && osMap[paciente.os_config_id] ? osMap[paciente.os_config_id] : 'Particular',
      paciente: paciente ? { nombre: paciente.nombre, apellido: paciente.apellido } : null,
    }
  })

  // Sin venir, deuda y OS sin liquidar vienen agregados desde RPC (sin tope de
  // 1000 filas; la RPC ya resuelve colaborador/ve_cobros). Defensa en
  // profundidad: sin permiso de cobros nunca viajan montos al cliente.
  const pacientesSinVenir = (sinVenirRaw ?? []) as { id: string; nombre: string; apellido: string; ultimaCita: string | null; telefono: string | null }[]
  const deuda = veCobros
    ? (deudaRaw ?? { totalCount: 0, porMoneda: {}, top: [] }) as DeudaGlobal
    : { porMoneda: {}, totalCount: 0, top: [] }
  const osSinLiquidar = veCobros
    ? (osSinLiquidarRaw ?? { totalCount: 0, porMoneda: {}, meses: [] }) as OsSinLiquidarGlobal
    : { totalCount: 0, porMoneda: {}, meses: [] }

  const seriesVencenProps = (seriesVencen ?? []).map((s) => ({
    id: s.id,
    pacienteId: s.paciente_id,
    fecha_fin: s.fecha_fin,
    paciente: resolverPaciente(s.paciente_id, s.paciente as unknown as { nombre: string; apellido: string; os_config_id: string | null } | null),
  }))

  const presetsInfo = PRESETS.map((key) => {
    const r = resolverPeriodo(key, hoyArgStr)
    return { key, label: PRESET_LABELS[key], desde: r.desde, hasta: r.hasta }
  })

  const props = {
    nombreTerapeuta,
    plan,
    veCobros,
    periodo: {
      preset, desde: periodo.desde, hasta: periodo.hasta,
      cmpTipo, cmpLabel: comparacion.label, cmpDesde: comparacion.desde, cmpHasta: comparacion.hasta,
    },
    presetsInfo,
    resumen,
    serieMensual,
    hoyArgStr,
    hoy,
    periodoTurnos,
    pacientesSinVenir,
    deuda,
    osSinLiquidar,
    seriesVencen: seriesVencenProps,
  }

  return <DashboardClient {...props} />
}
