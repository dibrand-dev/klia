import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PacienteDetalle from '@/components/pacientes/PacienteDetalle'
import PacienteHeader, { type SummaryData } from '@/components/pacientes/PacienteHeader'
import PacienteTabs, { type PacienteTabKey } from '@/components/pacientes/PacienteTabs'
import { OBRAS_SOCIALES } from '@/lib/obras-sociales'

export const metadata = { title: 'Paciente — KLIA' }

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

  const [{ data: paciente }, { data: profile }, turnosRes, notasRes, medicacionesRes, profOSRes] = await Promise.all([
    supabase
      .from('pacientes')
      .select('*')
      .eq('id', params.id)
      .eq('terapeuta_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('cobrar_inasistencias')
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
      .eq('terapeuta_id', user.id),
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
  ])

  if (!paciente) notFound()

  const turnos = turnosRes.data || []
  const now = new Date()
  const sesionesRealizadas = turnos.filter((t) => t.estado === 'realizado').length
  const proximaSesion = turnos.find((t) => new Date(t.fecha_hora) >= now && t.estado !== 'cancelado' && t.estado !== 'no_asistio') || null
  const tratamientoDesde = turnos[0]?.fecha_hora ?? paciente.created_at
  const impagosTurnos = turnos.filter((t) => t.estado === 'realizado' && !t.pagado)
  const impagos = impagosTurnos.length
  const montoImpago = impagosTurnos.reduce((sum, t) => sum + (t.monto ?? 0), 0)

  const summary: SummaryData = {
    sesionesRealizadas,
    proximaSesion,
    tratamientoDesde,
    impagos,
    montoImpago,
  }

  const historialCount = notasRes.count || 0
  const medicaciones = medicacionesRes.data ?? []
  const turnosCount = turnos.filter((t) => t.estado !== 'cancelado').length

  const tab: PacienteTabKey =
    searchParams.tab === 'datos' ||
    searchParams.tab === 'historial' ||
    searchParams.tab === 'informes' ||
    searchParams.tab === 'documentos' ||
    searchParams.tab === 'facturacion' ||
    searchParams.tab === 'interconsultas'
      ? searchParams.tab
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
        key={editMode ? 'edit' : 'view'}
      />
    </div>
  )
}
