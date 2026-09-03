import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AtencionesClient from '@/components/atenciones/AtencionesClient'
import { getModulosConfig, puedeAcceder } from '@/lib/modulos'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

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
  const turnosTyped = (turnos ?? []).map(t => ({
    ...t,
    paciente: Array.isArray(t.paciente) ? t.paciente[0] ?? null : t.paciente,
  })) as TurnoConPaciente[]

  return <AtencionesClient turnos={turnosTyped} hoyArgStr={hoyArgStr} />
}
