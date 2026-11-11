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
  const anioArg = hoyArg.getUTCFullYear()
  const mesArg = hoyArg.getUTCMonth()
  const inicioMesActualUTC = new Date(Date.UTC(anioArg, mesArg, 1, 3, 0, 0))
  const treintaDiasStr = new Date(hoyArg.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dosSemanasUTC = new Date(inicioHoyUTC.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    { data: profile },
    modulos,
    { data: resumenRaw },
    { data: serieMensualRaw },
    { data: turnosHoy },
    { data: entrevistasHoy },
    { data: periodoTurnosRaw },
    { data: ultimosTurnos },
    { data: deudaTurnosRaw },
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

    supabase
      .from('turnos')
      .select('id, fecha_hora, estado, monto, moneda, pagado, estado_pago, monto_pagado, paciente_id, paciente:pacientes(nombre, apellido, os_config_id)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .gte('fecha_hora', inicioPeriodoUTC.toISOString())
      .lt('fecha_hora', finPeriodoUTC.toISOString()),

    supabase
      .from('turnos')
      .select('paciente_id, fecha_hora')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('estado', 'realizado')
      .order('fecha_hora', { ascending: false }),

    // Deuda GLOBAL de pacientes particulares (sin filtro de fecha — mismo
    // criterio que /cobros: estado realizado/no_asistio, no bonificado,
    // con saldo real vía monto_pagado, nunca solo `pagado`).
    supabase
      .from('turnos')
      .select('id, fecha_hora, monto, moneda, monto_pagado, paciente_id, paciente:pacientes(nombre, apellido, os_config_id)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .in('estado', ['realizado', 'no_asistio'])
      .in('estado_pago', ['pendiente', 'pago_parcial'])
      .lte('fecha_hora', ahora.toISOString()),

    // OS sin liquidar de TODOS los meses anteriores (no sólo el mes
    // pasado) — se agrupa por mes dinámicamente en el cliente.
    supabase
      .from('turnos')
      .select('id, fecha_hora, monto, moneda, monto_pagado, paciente_id, paciente:pacientes(nombre, apellido, os_config_id)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .in('estado', ['realizado', 'no_asistio'])
      .in('estado_pago', ['pendiente', 'pago_parcial'])
      .lt('fecha_hora', inicioMesActualUTC.toISOString()),

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
      monto: t.monto,
      moneda: t.moneda ?? 'ARS',
      pagado: t.pagado,
      montoPagado: t.monto_pagado ?? 0,
      origen: paciente?.os_config_id && osMap[paciente.os_config_id] ? osMap[paciente.os_config_id] : 'Particular',
      paciente: paciente ? { nombre: paciente.nombre, apellido: paciente.apellido } : null,
    }
  })

  // Pacientes sin venir 2+ semanas (misma lógica de stage 1, sin cambios)
  const ultimaCitaMap: Record<string, string> = {}
  for (const t of ultimosTurnos ?? []) {
    if (!ultimaCitaMap[t.paciente_id]) ultimaCitaMap[t.paciente_id] = t.fecha_hora
  }
  const pacientesAusentesIds: string[] = []
  for (const [pacienteId, ultimaCita] of Object.entries(ultimaCitaMap)) {
    if (new Date(ultimaCita) < dosSemanasUTC) pacientesAusentesIds.push(pacienteId)
  }
  let pacientesSinVenir: { id: string; nombre: string; apellido: string; ultimaCita: string | null; telefono: string | null }[] = []
  if (efectivo.esColaborador) {
    pacientesSinVenir = pacientesAusentesIds
      .map((id) => {
        const p = mapaPacientesColaborador.get(id)
        return p && p.activo ? { id, nombre: p.nombre, apellido: p.apellido, ultimaCita: ultimaCitaMap[id] ?? null, telefono: p.telefono } : null
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
  } else {
    const { data: lista } = pacientesAusentesIds.length > 0
      ? await supabase.from('pacientes').select('id, nombre, apellido, telefono').eq('terapeuta_id', efectivo.terapeutaId).eq('activo', true).in('id', pacientesAusentesIds)
      : { data: [] }
    pacientesSinVenir = (lista ?? []).map((p) => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, ultimaCita: ultimaCitaMap[p.id] ?? null, telefono: p.telefono }))
  }

  // Deuda global de pacientes particulares
  const deudaPorPaciente = new Map<string, { nombre: string; apellido: string; saldo: number; moneda: string; n: number; masAntigua: string }>()
  const deudaPorMoneda: Record<string, { total: number; count: number }> = {}
  for (const t of deudaTurnosRaw ?? []) {
    const paciente = resolverPaciente(t.paciente_id, t.paciente as unknown as { nombre: string; apellido: string; os_config_id: string | null } | null)
    if (!paciente || paciente.os_config_id) continue // sólo particulares
    const saldo = Math.max(0, (t.monto ?? 0) - (t.monto_pagado ?? 0))
    if (saldo <= 0) continue
    const moneda = t.moneda ?? 'ARS'
    if (!deudaPorMoneda[moneda]) deudaPorMoneda[moneda] = { total: 0, count: 0 }
    deudaPorMoneda[moneda].total += saldo
    deudaPorMoneda[moneda].count++
    const prev = deudaPorPaciente.get(t.paciente_id)
    if (!prev) {
      deudaPorPaciente.set(t.paciente_id, { nombre: paciente.nombre, apellido: paciente.apellido, saldo, moneda, n: 1, masAntigua: t.fecha_hora })
    } else {
      prev.saldo += saldo
      prev.n++
      if (t.fecha_hora < prev.masAntigua) prev.masAntigua = t.fecha_hora
    }
  }
  const deuda = {
    porMoneda: deudaPorMoneda,
    totalCount: deudaPorPaciente.size,
    top: Array.from(deudaPorPaciente.entries())
      .map(([pacienteId, d]) => ({ pacienteId, ...d }))
      .sort((a, b) => b.saldo - a.saldo),
  }

  // OS sin liquidar — todos los meses anteriores, agrupados dinámicamente
  const osPorMes = new Map<string, Map<string, { osNombre: string; n: number; monto: number; moneda: string }>>()
  const osTotalPorMoneda: Record<string, number> = {}
  let osTotalCount = 0
  for (const t of osSinLiquidarRaw ?? []) {
    const paciente = resolverPaciente(t.paciente_id, t.paciente as unknown as { nombre: string; apellido: string; os_config_id: string | null } | null)
    if (!paciente?.os_config_id) continue
    const saldo = Math.max(0, (t.monto ?? 0) - (t.monto_pagado ?? 0))
    if (saldo <= 0) continue
    const moneda = t.moneda ?? 'ARS'
    const mesKey = new Date(new Date(t.fecha_hora).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7) // YYYY-MM en ART
    const osNombre = osMap[paciente.os_config_id] ?? 'Obra social'
    if (!osPorMes.has(mesKey)) osPorMes.set(mesKey, new Map())
    const grupoMes = osPorMes.get(mesKey)!
    const clave = `${osNombre}__${moneda}`
    if (!grupoMes.has(clave)) grupoMes.set(clave, { osNombre, n: 0, monto: 0, moneda })
    const fila = grupoMes.get(clave)!
    fila.n++
    fila.monto += saldo
    osTotalPorMoneda[moneda] = (osTotalPorMoneda[moneda] ?? 0) + saldo
    osTotalCount++
  }
  const osSinLiquidar = {
    totalCount: osTotalCount,
    porMoneda: osTotalPorMoneda,
    meses: Array.from(osPorMes.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mesKey, filas]) => ({ mesKey, filas: Array.from(filas.values()) })),
  }

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
