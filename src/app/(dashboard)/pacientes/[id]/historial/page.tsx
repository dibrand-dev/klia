import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PacienteHeader, { type SummaryData } from '@/components/pacientes/PacienteHeader'
import PacienteTabs from '@/components/pacientes/PacienteTabs'
import HistorialList from '@/components/pacientes/HistorialList'

export const metadata = { title: 'Historial clínico — KLIA' }

export default async function HistorialPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: paciente }, { data: notas }, { data: turnos }] = await Promise.all([
    supabase
      .from('pacientes')
      .select('*')
      .eq('id', params.id)
      .eq('terapeuta_id', user.id)
      .single(),
    supabase
      .from('notas_clinicas')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', user.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('turnos')
      .select('*')
      .eq('paciente_id', params.id)
      .eq('terapeuta_id', user.id)
      .order('fecha_hora', { ascending: true }),
  ])

  if (!paciente) notFound()

  const turnosList = turnos || []
  const notasList = notas || []
  const now = new Date()
  const sesionesRealizadas = turnosList.filter((t) => t.estado === 'realizado').length
  const proximaSesion = turnosList.find((t) => new Date(t.fecha_hora) >= now && t.estado !== 'cancelado' && t.estado !== 'no_asistio') || null
  const tratamientoDesde = turnosList[0]?.fecha_hora ?? paciente.created_at
  const impagosTurnos = turnosList.filter((t) => t.estado === 'realizado' && !t.pagado)
  const impagos = impagosTurnos.length
  const montoImpago = impagosTurnos.reduce((sum, t) => sum + (t.monto ?? 0), 0)

  const summary: SummaryData = {
    sesionesRealizadas,
    proximaSesion,
    tratamientoDesde,
    impagos,
    montoImpago,
  }

  const totalNotas = notasList.length

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
      <PacienteHeader paciente={paciente} summary={summary} />
      <PacienteTabs
        pacienteId={paciente.id}
        active="historial"
        historialCount={totalNotas}
      />

      {totalNotas === 0 ? (
        <div className="mt-6 border border-dashed border-outline-variant/30 rounded-xl bg-surface-container-lowest p-10 text-center">
          <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 28 }}>clinical_notes</span>
          </div>
          <h3 className="text-[15px] font-bold text-on-surface mb-1 tracking-tight">Todavía no hay notas para este paciente</h3>
          <p className="text-[13px] text-on-surface-variant mb-5">Las notas aparecen al marcar un turno como realizado o podés crearlas manualmente.</p>
          <Link href={`/pacientes/${params.id}/historial/nueva`} className="btn-primary inline-flex">
            <span className="material-symbols-outlined text-sm">add</span>
            Crear primera nota
          </Link>
        </div>
      ) : (
        <HistorialList notas={notasList} turnos={turnosList} pacienteId={params.id} />
      )}
    </div>
  )
}
