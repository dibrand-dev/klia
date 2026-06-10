import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getModulosConfig, puedeAcceder } from '@/lib/modulos'
import CobrosClient from '@/components/cobros/CobrosClient'
import type { TurnoDeuda, TopDeudor } from '@/components/cobros/CobrosClient'

export const metadata = { title: 'Cobros — KLIA' }

export default async function CobrosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, modulos] = await Promise.all([
    supabase
      .from('profiles')
      .select('nombre, apellido, especialidad, cobrar_inasistencias, plan')
      .eq('id', user.id)
      .single(),
    getModulosConfig(supabase),
  ])

  if (!puedeAcceder('cobros', profile?.plan ?? '', modulos)) {
    redirect('/planes')
  }

  // Fetch obras sociales for name mapping
  const { data: profesionalObrasSociales } = await supabase
    .from('profesional_obras_sociales')
    .select('id, nombre')
    .eq('terapeuta_id', user.id)

  const osMap: Record<string, string> = {}
  for (const os of profesionalObrasSociales ?? []) {
    osMap[os.id] = os.nombre
  }

  // Fetch turnos with unpaid/partial status
  const { data: turnosRaw } = await supabase
    .from('turnos')
    .select(`
      id,
      fecha_hora,
      duracion_min,
      monto,
      moneda,
      estado,
      estado_pago,
      monto_pagado,
      paciente:pacientes (
        id,
        nombre,
        apellido,
        os_config_id,
        cobrar_inasistencias,
        moneda_preferida
      )
    `)
    .eq('terapeuta_id', user.id)
    .in('estado', ['realizado', 'no_asistio'])
    .in('estado_pago', ['pendiente', 'pago_parcial', 'bonificado'])
    .eq('pagado', false)
    .lte('fecha_hora', new Date().toISOString())
    .order('fecha_hora', { ascending: false })

  // Argentina UTC-3 current month boundaries
  const ahora = new Date()
  const hoyArg = new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
  const mesArg = hoyArg.getUTCMonth()
  const anioArg = hoyArg.getUTCFullYear()
  const inicioMes = new Date(Date.UTC(anioArg, mesArg, 1, 3, 0, 0))
  const finMes = new Date(Date.UTC(anioArg, mesArg + 1, 1, 3, 0, 0))

  const cobrarInasistenciasProf = profile?.cobrar_inasistencias ?? false

  const turnos: TurnoDeuda[] = []

  for (const raw of turnosRaw ?? []) {
    const paciente = Array.isArray(raw.paciente) ? raw.paciente[0] : raw.paciente
    if (!paciente) continue

    const cobrarInasistencia = paciente.cobrar_inasistencias ?? cobrarInasistenciasProf
    if (raw.estado === 'no_asistio' && !cobrarInasistencia) continue

    const osNombre = paciente.os_config_id ? (osMap[paciente.os_config_id] ?? null) : null

    turnos.push({
      id: raw.id,
      fecha_hora: raw.fecha_hora,
      duracion_min: raw.duracion_min,
      monto: raw.monto ?? 0,
      moneda: raw.moneda ?? 'ARS',
      estado: raw.estado ?? 'realizado',
      estado_pago: (raw.estado_pago as TurnoDeuda['estado_pago']) ?? 'pendiente',
      monto_pagado: raw.monto_pagado ?? 0,
      paciente_id: paciente.id,
      paciente_nombre: paciente.nombre,
      paciente_apellido: paciente.apellido,
      os_config_id: paciente.os_config_id ?? null,
      os_nombre: osNombre,
    })
  }

  // Compute summary stats (only pendiente + pago_parcial have real saldo)
  let particAdeudado = 0
  let particMesActual = 0
  let osAdeudado = 0
  let osMesActual = 0
  let particAdeudadoCount = 0
  let osAdeudadoCount = 0

  for (const t of turnos) {
    if (t.estado_pago === 'bonificado') continue
    const saldo = Math.max(0, t.monto - t.monto_pagado)
    if (saldo <= 0) continue

    const dt = new Date(t.fecha_hora)
    const enMes = dt >= inicioMes && dt < finMes

    if (!t.os_config_id) {
      particAdeudado += saldo
      particAdeudadoCount++
      if (enMes) particMesActual += saldo
    } else {
      osAdeudado += saldo
      osAdeudadoCount++
      if (enMes) osMesActual += saldo
    }
  }

  // Compute top 3 debtors
  const saldoByPaciente: Record<string, { nombre: string; apellido: string; os_nombre: string | null; saldo: number; moneda: string }> = {}
  for (const t of turnos) {
    if (t.estado_pago === 'bonificado') continue
    const saldo = Math.max(0, t.monto - t.monto_pagado)
    if (saldo <= 0) continue
    if (!saldoByPaciente[t.paciente_id]) {
      saldoByPaciente[t.paciente_id] = {
        nombre: t.paciente_nombre,
        apellido: t.paciente_apellido,
        os_nombre: t.os_nombre,
        saldo: 0,
        moneda: t.moneda,
      }
    }
    saldoByPaciente[t.paciente_id].saldo += saldo
  }

  const top3: TopDeudor[] = Object.entries(saldoByPaciente)
    .map(([paciente_id, data]) => ({ paciente_id, ...data }))
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 3)

  const moneda = turnos[0]?.moneda ?? 'ARS'

  return (
    <CobrosClient
      turnos={turnos}
      top3={top3}
      summary={{ particAdeudado, particMesActual, osAdeudado, osMesActual, particAdeudadoCount, osAdeudadoCount }}
      terapeutaId={user.id}
      moneda={moneda}
    />
  )
}
