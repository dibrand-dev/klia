import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AtencionesClient from '@/components/atenciones/AtencionesClient'
import { getModulosConfig, puedeAcceder } from '@/lib/modulos'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import type { PacienteColaboradorRow } from '@/types/database'

export const metadata = { title: 'Atenciones del Día — KLIA' }

export default async function AtencionesPage() {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const [{ data: profile }, modulos] = await Promise.all([
    supabase.from('profiles').select('plan').eq('id', efectivo.terapeutaId).single(),
    getModulosConfig(supabase),
  ])

  if (!puedeAcceder('atenciones', profile?.plan ?? '', modulos)) {
    redirect('/planes')
  }

  // Argentina UTC-3
  const ahora = new Date()
  const hoyArg = new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
  const hoyArgStr = hoyArg.toISOString().slice(0, 10)
  const inicioHoyUTC = new Date(`${hoyArgStr}T03:00:00.000Z`)
  const finHoyUTC = new Date(inicioHoyUTC.getTime() + 24 * 60 * 60 * 1000)

  // Mapa de pacientes para colaboradora — el join embebido de abajo no resuelve
  // para ella por RLS (sin policy de SELECT directa sobre `pacientes`), mismo
  // patrón ya usado en Dashboard/Cobros. codigo_diagnostico queda fuera del RPC
  // a propósito (campo clínico) — cae al fallback existente en AtencionesClient.
  const mapaPacientesColaborador = new Map<string, {
    nombre: string
    apellido: string
    fecha_nacimiento: string | null
    obra_social: string | null
    os_config_id: string | null
    modalidad_tratamiento: string | null
    autorizacion_vigencia_hasta: string | null
  }>()
  if (efectivo.esColaborador) {
    const { data: todosPacientesRaw } = await supabase.rpc('get_pacientes_colaborador')
    const todosPacientes = (todosPacientesRaw ?? []) as PacienteColaboradorRow[]
    for (const p of todosPacientes) {
      mapaPacientesColaborador.set(p.id, {
        nombre: p.nombre,
        apellido: p.apellido,
        fecha_nacimiento: p.fecha_nacimiento,
        obra_social: p.obra_social,
        os_config_id: p.os_config_id,
        modalidad_tratamiento: p.modalidad_tratamiento,
        autorizacion_vigencia_hasta: p.autorizacion_vigencia_hasta,
      })
    }
  }

  const { data: turnos } = await supabase
    .from('turnos')
    .select(`
      id,
      fecha_hora,
      duracion_min,
      modalidad,
      estado,
      ai_summary,
      estado_atencion,
      paciente_id,
      paciente:pacientes (
        id,
        nombre,
        apellido,
        fecha_nacimiento,
        obra_social,
        os_config_id,
        codigo_diagnostico,
        modalidad_tratamiento,
        autorizacion_vigencia_hasta
      )
    `)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .gte('fecha_hora', inicioHoyUTC.toISOString())
    .lt('fecha_hora', finHoyUTC.toISOString())
    .neq('estado', 'cancelado')
    .order('fecha_hora')

  type TurnoConPaciente = Parameters<typeof AtencionesClient>[0]['turnos'][number]
  const turnosTyped = (turnos ?? []).map(t => {
    const pacienteEmbebido = Array.isArray(t.paciente) ? t.paciente[0] ?? null : t.paciente
    const paciente = efectivo.esColaborador
      ? (mapaPacientesColaborador.get(t.paciente_id)
        ? { id: t.paciente_id, codigo_diagnostico: null, ...mapaPacientesColaborador.get(t.paciente_id) }
        : null)
      : pacienteEmbebido
    return { ...t, paciente }
  }) as TurnoConPaciente[]

  return <AtencionesClient turnos={turnosTyped} hoyArgStr={hoyArgStr} />
}
