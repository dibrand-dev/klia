import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PacienteDetalle from '@/components/pacientes/PacienteDetalle'
import PacienteHeader, { type SummaryData } from '@/components/pacientes/PacienteHeader'
import PacienteTabs, { type PacienteTabKey } from '@/components/pacientes/PacienteTabs'
import { OBRAS_SOCIALES } from '@/lib/obras-sociales'
import { calcularDeudaMes, resolverPoliticaInasistencia, sesionGeneraDeuda } from '@/lib/deuda'

export const metadata = { title: 'Paciente — KLIA' }
// Mismo motivo que /agenda y /cobros — evitar que el Data Cache de Next.js
// sirva saldo/turnos stale tras registrar un pago o eliminar un turno.
export const dynamic = 'force-dynamic'

export default async function PacienteDetallePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string; edit?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: paciente }, { data: profile }, turnosRes, notasRes, medicacionesRes, profOSRes, { data: turnoRecurrente }, { data: googleTokens }] = await Promise.all([
    supabase
      .from('pacientes')
      .select('*')
      .eq('id', params.id)
      .eq('terapeuta_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('cobrar_inasistencias, nombre, apellido, especialidad, matricula, matricula_tipo, matricula_provincia, direccion, localidad, provincia, email, telefono, firma_sello_url')
      .eq('id', user.id)
      .single(),
    supabase
      .from('turnos')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', user.id)
      .order('fecha_hora', { ascending: true }),
    supabase
      .from('notas_clinicas')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', user.id)
      .not('borrador', 'is', true),
    supabase
      .from('medicacion_paciente')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', user.id)
      .order('created_at'),
    supabase
      .from('profesional_obras_sociales')
      .select('*')
      .eq('terapeuta_id', user.id)
      .eq('activa', true)
      .order('nombre'),
    supabase
      .from('turnos_recurrentes')
      .select('dia_semana, hora')
      .eq('terapeuta_id', user.id)
      .eq('paciente_id', params.id)
      .eq('activo', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('terapeuta_id', user.id)
      .maybeSingle(),
  ])

  if (!paciente) notFound()

  const turnos = turnosRes.data || []
  const now = new Date()
  const sesionesRealizadas = turnos.filter((t) => t.estado === 'realizado').length
  const proximaSesion = turnos.find((t) => new Date(t.fecha_hora) >= now && t.estado !== 'cancelado' && t.estado !== 'no_asistio') || null
  const tratamientoDesde = turnos[0]?.fecha_hora ?? paciente.created_at
  // Mismo cálculo que Cobros/DetallePacienteSlide (src/lib/deuda.ts) — antes se
  // sumaba el monto bruto de toda sesión no pagada al 100%, ignorando pagos
  // parciales ya registrados (monto_pagado), lo que inflaba el saldo mostrado
  // acá muy por encima del saldo real pendiente.
  const cobrarInasistencia = resolverPoliticaInasistencia(paciente.cobrar_inasistencias, profile?.cobrar_inasistencias ?? false)
  const deudaResumen = calcularDeudaMes(turnos, cobrarInasistencia)
  const montoImpago = Object.values(deudaResumen.montoPendiente).reduce((sum, v) => sum + (v ?? 0), 0)
  const impagos = turnos.filter((t) => {
    if (!sesionGeneraDeuda(t.estado, cobrarInasistencia)) return false
    if (t.pagado) return false
    const cobrado = Math.min(t.monto_pagado ?? 0, t.monto ?? 0)
    return (t.monto ?? 0) - cobrado > 0
  }).length

  const summary: SummaryData = {
    sesionesRealizadas,
    proximaSesion,
    tratamientoDesde,
    impagos,
    montoImpago,
  }

  const historialCount = notasRes.count || 0
  const medicaciones = medicacionesRes.data ?? []
  const tieneDrive = !!googleTokens

  const tab: PacienteTabKey =
    searchParams.tab === 'datos' ||
    searchParams.tab === 'historial' ||
    searchParams.tab === 'informes' ||
    (searchParams.tab === 'archivos' && tieneDrive) ||
    searchParams.tab === 'admision' ||
    searchParams.tab === 'facturacion' ||
    searchParams.tab === 'interconsultas'
      ? (searchParams.tab as PacienteTabKey)
      : 'resumen'

  const interconsultasRes = tab === 'interconsultas'
    ? await supabase.rpc('get_interconsultas', { p_paciente_id: params.id })
    : { data: [] }
  const interconsultas = (interconsultasRes.data ?? []) as Array<{
    nombre: string; apellido: string; especialidad: string | null; telefono: string | null; email: string | null
  }>

  const editMode = searchParams.edit === '1'
  const profObrasSociales = profOSRes.data ?? []

  // Lista maestra estática + nombres de OS del profesional que no estén ya incluidas
  const profNombres = profObrasSociales.map((o) => o.nombre)
  const obrasSociales = Array.from(new Set([...OBRAS_SOCIALES, ...profNombres])).sort()

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
      <PacienteHeader paciente={paciente} summary={summary} />
      <PacienteTabs
        pacienteId={paciente.id}
        active={tab}
        historialCount={historialCount}
        tieneDrive={tieneDrive}
        especialidad={profile?.especialidad}
      />
      <PacienteDetalle
        paciente={paciente}
        medicacionesIniciales={medicaciones}
        interconsultas={interconsultas}
        activeTab={tab}
        initialEdit={editMode}
        obrasSociales={obrasSociales}
        profObrasSociales={profObrasSociales}
        turnos={turnos}
        profesionalCobrarInasistencias={profile?.cobrar_inasistencias ?? false}
        profesionalData={profile ? {
          nombre: (profile as Record<string, unknown>).nombre as string ?? '',
          apellido: (profile as Record<string, unknown>).apellido as string ?? '',
          especialidad: (profile as Record<string, unknown>).especialidad as string | null ?? null,
          matricula: (profile as Record<string, unknown>).matricula as string | null ?? null,
          matricula_tipo: (profile as Record<string, unknown>).matricula_tipo as string | null ?? null,
          matricula_provincia: (profile as Record<string, unknown>).matricula_provincia as string | null ?? null,
          localidad: (profile as Record<string, unknown>).localidad as string | null ?? null,
          provincia: (profile as Record<string, unknown>).provincia as string | null ?? null,
          direccion: (profile as Record<string, unknown>).direccion as string | null ?? null,
          email: (profile as Record<string, unknown>).email as string ?? '',
          telefono: (profile as Record<string, unknown>).telefono as string | null ?? null,
          firma_sello_url: (profile as Record<string, unknown>).firma_sello_url as string | null ?? null,
        } : null}
        turnoRecurrente={turnoRecurrente ?? null}
        tieneDrive={tieneDrive}
        key={editMode ? 'edit' : 'view'}
      />
    </div>
  )
}
