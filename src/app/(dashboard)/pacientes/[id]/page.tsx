import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PacienteDetalle from '@/components/pacientes/PacienteDetalle'
import PacienteHeader, { type SummaryData } from '@/components/pacientes/PacienteHeader'
import PacienteTabs, { type PacienteTabKey } from '@/components/pacientes/PacienteTabs'

export const metadata = { title: 'Paciente — ConsultorioApp' }

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

  const [{ data: paciente }, turnosRes, notasRes] = await Promise.all([
    supabase
      .from('pacientes')
      .select('*')
      .eq('id', params.id)
      .eq('terapeuta_id', user.id)
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
  const turnosCount = turnos.filter((t) => t.estado !== 'cancelado').length

  const tab: PacienteTabKey =
    searchParams.tab === 'resumen' ||
    searchParams.tab === 'turnos' ||
    searchParams.tab === 'documentos' ||
    searchParams.tab === 'notas'
      ? searchParams.tab
      : 'datos'

  const editMode = searchParams.edit === '1'

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 md:px-7 pb-20">
      <PacienteHeader paciente={paciente} summary={summary} />
      <PacienteTabs
        pacienteId={paciente.id}
        active={tab}
        historialCount={historialCount}
        turnosCount={turnosCount}
      />
      <PacienteDetalle paciente={paciente} activeTab={tab} initialEdit={editMode} />
    </div>
  )
}
