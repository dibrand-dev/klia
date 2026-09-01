import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'
import type { Profile, PacienteColaboradorRow } from '@/types/database'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const metadata = { title: 'Dashboard — KLIA' }

export default async function DashboardPage() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  // Mapa único de pacientes para colaboradora — reusado en los 6 puntos de
  // este archivo que dependían de joins/consultas directas a `pacientes`,
  // bloqueados por RLS (sin policy de SELECT para colaboradora). Sin
  // filtrar por activo a propósito: un turno de un paciente inactivo debe
  // seguir mostrando su nombre, igual que ya pasa para el profesional vía
  // el join embebido sin filtro.
  const mapaPacientesColaborador = new Map<string, { nombre: string; apellido: string; os_config_id: string | null; activo: boolean }>()
  let todosPacientesColaborador: PacienteColaboradorRow[] = []
  if (efectivo.esColaborador) {
    const { data: todosPacientesRaw } = await supabase.rpc('get_pacientes_colaborador')
    todosPacientesColaborador = (todosPacientesRaw ?? []) as PacienteColaboradorRow[]
    for (const p of todosPacientesColaborador) {
      mapaPacientesColaborador.set(p.id, { nombre: p.nombre, apellido: p.apellido, os_config_id: p.os_config_id, activo: p.activo })
    }
  }

  // Argentina = UTC-3 (no DST)
  const ahora = new Date()
  const hoyArg = new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
  const hoyArgStr = hoyArg.toISOString().slice(0, 10) // YYYY-MM-DD in Argentina

  // Day boundaries in UTC (Argentina midnight = UTC 03:00)
  const inicioHoyUTC = new Date(`${hoyArgStr}T03:00:00.000Z`)
  const finHoyUTC = new Date(inicioHoyUTC.getTime() + 24 * 60 * 60 * 1000)

  // Month boundaries
  const anioArg = hoyArg.getUTCFullYear()
  const mesArg = hoyArg.getUTCMonth()
  const inicioMesUTC = new Date(Date.UTC(anioArg, mesArg, 1, 3, 0, 0))
  const finMesUTC = new Date(Date.UTC(anioArg, mesArg + 1, 1, 3, 0, 0))

  // Previous month for liquidation alert
  const inicioMesAnteriorUTC = new Date(Date.UTC(anioArg, mesArg - 1, 1, 3, 0, 0))

  // Week boundaries (Monday–Sunday)
  const diaSemana = hoyArg.getUTCDay() // 0=Sun, 1=Mon...
  const diasDesdeL = diaSemana === 0 ? 6 : diaSemana - 1
  const inicioSemanaArg = new Date(hoyArg.getTime() - diasDesdeL * 24 * 60 * 60 * 1000)
  const inicioSemanaStr = inicioSemanaArg.toISOString().slice(0, 10)
  const finSemanaArg = new Date(inicioSemanaArg.getTime() + 6 * 24 * 60 * 60 * 1000)
  const finSemanaStr = finSemanaArg.toISOString().slice(0, 10)

  // 30-day threshold for expiring series
  const treintaDiasStr = new Date(hoyArg.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // 2-week threshold for absent patients
  const dosSemanasUTC = new Date(inicioHoyUTC.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    { data: profile },
    { data: turnosHoy },
    { data: turnosMes },
    { data: entrevistasHoy },
    { data: seriesVencen },
    { data: pacientesActivos },
    { data: ultimosTurnos },
    { data: obrasSociales },
    { data: turnosMesAnteriorSinPagar },
  ] = await Promise.all([
    supabase.from('profiles').select('nombre').eq('id', efectivo.terapeutaId).single(),

    supabase
      .from('turnos')
      .select('id, fecha_hora, estado, paciente_id, paciente:pacientes(nombre, apellido)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .gte('fecha_hora', inicioHoyUTC.toISOString())
      .lt('fecha_hora', finHoyUTC.toISOString())
      .neq('estado', 'cancelado')
      .order('fecha_hora'),

    supabase
      .from('turnos')
      .select('id, estado, monto, moneda, pagado, paciente_id, paciente:pacientes(nombre, apellido, obra_social, os_config_id)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .gte('fecha_hora', inicioMesUTC.toISOString())
      .lt('fecha_hora', finMesUTC.toISOString()),

    supabase
      .from('entrevistas')
      .select('id, nombre, apellido, hora, estado')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('fecha', hoyArgStr)
      .neq('estado', 'cancelada'),

    supabase
      .from('turnos_recurrentes')
      .select('id, fecha_fin, paciente_id, paciente:pacientes(nombre, apellido)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('activo', true)
      .lte('fecha_fin', treintaDiasStr)
      .order('fecha_fin'),

    supabase
      .from('pacientes')
      .select('id')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('activo', true),

    supabase
      .from('turnos')
      .select('paciente_id, fecha_hora')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('estado', 'realizado')
      .order('fecha_hora', { ascending: false }),

    supabase
      .from('profesional_obras_sociales')
      .select('id, nombre')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('activa', true),

    supabase
      .from('turnos')
      .select('id, pagado, paciente_id, paciente:pacientes(os_config_id)')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('pagado', false)
      .gte('fecha_hora', inicioMesAnteriorUTC.toISOString())
      .lt('fecha_hora', inicioMesUTC.toISOString())
      .in('estado', ['realizado', 'no_asistio']),
  ])

  // Compute patients absent > 2 weeks
  const ultimaCitaMap: Record<string, string> = {}
  for (const t of ultimosTurnos ?? []) {
    if (!ultimaCitaMap[t.paciente_id]) {
      ultimaCitaMap[t.paciente_id] = t.fecha_hora
    }
  }

  const pacientesAusentesIds: string[] = []
  for (const [pacienteId, ultimaCita] of Object.entries(ultimaCitaMap)) {
    if (new Date(ultimaCita) < dosSemanasUTC) {
      pacientesAusentesIds.push(pacienteId)
    }
  }

  // Fetch details of absent patients
  let pacientesAusentesConFecha: { id: string; nombre: string; apellido: string; ultimaCita: string | null }[] = []
  if (efectivo.esColaborador) {
    pacientesAusentesConFecha = pacientesAusentesIds
      .map((id) => {
        const p = mapaPacientesColaborador.get(id)
        return p && p.activo ? { id, nombre: p.nombre, apellido: p.apellido, ultimaCita: ultimaCitaMap[id] ?? null } : null
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
  } else {
    const { data: pacientesAusentesList } = pacientesAusentesIds.length > 0
      ? await supabase
          .from('pacientes')
          .select('id, nombre, apellido')
          .eq('terapeuta_id', efectivo.terapeutaId)
          .eq('activo', true)
          .in('id', pacientesAusentesIds)
      : { data: [] }

    pacientesAusentesConFecha = (pacientesAusentesList ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      apellido: p.apellido,
      ultimaCita: ultimaCitaMap[p.id] ?? null,
    }))
  }

  // Income by source
  const osMap: Record<string, string> = {}
  for (const os of obrasSociales ?? []) osMap[os.id] = os.nombre

  const ingresosPorOrigenMap: Record<string, number> = {}
  const ingresosMesPorMonedaMap: Record<string, number> = {}
  for (const t of turnosMes ?? []) {
    if (!t.pagado || !t.monto) continue
    const osConfigId = efectivo.esColaborador
      ? mapaPacientesColaborador.get(t.paciente_id)?.os_config_id ?? null
      : (t.paciente as unknown as { os_config_id: string | null } | null)?.os_config_id ?? null
    const clave = osConfigId && osMap[osConfigId]
      ? osMap[osConfigId]
      : 'Particular'
    ingresosPorOrigenMap[clave] = (ingresosPorOrigenMap[clave] ?? 0) + t.monto
    const moneda = (t as unknown as { moneda?: string }).moneda || 'ARS'
    ingresosMesPorMonedaMap[moneda] = (ingresosMesPorMonedaMap[moneda] ?? 0) + t.monto
  }

  // Pending income this month — only realizado/no_asistio unpaid (future turnos don't generate debt yet)
  const ingresosPendientesPorMonedaMap: Record<string, number> = {}
  for (const t of turnosMes ?? []) {
    if (t.pagado || !t.monto) continue
    if (!['realizado', 'no_asistio'].includes(t.estado)) continue
    const moneda = (t as unknown as { moneda?: string }).moneda || 'ARS'
    ingresosPendientesPorMonedaMap[moneda] = (ingresosPendientesPorMonedaMap[moneda] ?? 0) + t.monto
  }
  const ingresosPendientes = Object.values(ingresosPendientesPorMonedaMap).reduce((a, b) => a + b, 0)

  // Check if previous month has unpaid OS sessions
  const tieneSesionesAnteriorSinLiquidar = (turnosMesAnteriorSinPagar ?? []).some((t) => {
    const osConfigId = efectivo.esColaborador
      ? mapaPacientesColaborador.get(t.paciente_id)?.os_config_id ?? null
      : (t.paciente as unknown as { os_config_id: string | null } | null)?.os_config_id ?? null
    return osConfigId != null
  })

  let nombreTerapeuta = (profile as Profile | null)?.nombre ?? ''
  if (efectivo.esColaborador) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: perfilPropio } = await supabase.from('profiles').select('nombre').eq('id', user.id).single()
      if (perfilPropio?.nombre) nombreTerapeuta = perfilPropio.nombre
    }
  }

  const props = {
    nombreTerapeuta,
    hoyArgStr,
    turnosHoy: (turnosHoy ?? []).map((t) => ({
      id: t.id,
      fecha_hora: t.fecha_hora,
      estado: t.estado,
      paciente: efectivo.esColaborador
        ? mapaPacientesColaborador.get(t.paciente_id) ?? null
        : (t.paciente as unknown as { nombre: string; apellido: string } | null),
    })),
    entrevistasHoy: (entrevistasHoy ?? []).map((e) => ({
      id: e.id,
      nombre: e.nombre,
      apellido: e.apellido,
      hora: e.hora,
      estado: e.estado,
    })),
    totalPacientesActivos: efectivo.esColaborador
      ? todosPacientesColaborador.filter((p) => p.activo).length
      : pacientesActivos?.length ?? 0,
    pacientesAusentes: pacientesAusentesConFecha,
    sesionesRealizadasMes: (turnosMes ?? []).filter((t) => t.estado === 'realizado').length,
    sesionesPendientesMes: (turnosMes ?? []).filter((t) => t.estado === 'pendiente' || t.estado === 'confirmado').length,
    ingresosMes: Object.values(ingresosPorOrigenMap).reduce((a, b) => a + b, 0),
    ingresosMesPorMoneda: ingresosMesPorMonedaMap,
    ingresosPendientes,
    ingresosPendientesPorMoneda: ingresosPendientesPorMonedaMap,
    ingresosPorOrigen: Object.entries(ingresosPorOrigenMap).map(([nombre, monto]) => ({ nombre, monto })),
    seriesVencen: (seriesVencen ?? []).map((s) => ({
      id: s.id,
      fecha_fin: s.fecha_fin,
      paciente: efectivo.esColaborador
        ? mapaPacientesColaborador.get(s.paciente_id) ?? null
        : (s.paciente as unknown as { nombre: string; apellido: string } | null),
    })),
    tieneSesionesAnteriorSinLiquidar,
    inicioSemanaStr,
    finSemanaStr,
  }

  return <DashboardClient {...props} />
}
