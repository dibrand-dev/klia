import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ListaPacientes from '@/components/pacientes/ListaPacientes'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import type { Paciente, PacienteColaboradorRow } from '@/types/database'

export const metadata = { title: 'Pacientes — KLIA' }
// Evitar que el Data Cache de Next.js sirva la lista stale tras crear/editar un paciente
// (mismo motivo que /agenda, /cobros y /pacientes/[id]).
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const pageNum = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let pacientes: Paciente[] | null
  let totalCount: number

  const [{ data: profile }, { data: turnos }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', efectivo.terapeutaId)
      .single(),
    supabase
      .from('turnos')
      .select('paciente_id, fecha_hora')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .eq('estado', 'realizado')
      .order('fecha_hora', { ascending: false }),
  ])

  if (efectivo.esColaborador) {
    // La colaboradora no tiene policy de SELECT directa sobre `pacientes`
    // (a propósito, por las columnas clínicas) — su acceso pasa por esta
    // función, que sí valida la colaboración activa server-side.
    const { data: todosPacientesRaw } = await supabase.rpc('get_pacientes_colaborador')
    const todosPacientes = (todosPacientesRaw ?? []) as PacienteColaboradorRow[]
    const ordenados = todosPacientes.sort((a, b) => a.apellido.localeCompare(b.apellido))
    totalCount = ordenados.length
    pacientes = ordenados.slice(from, to + 1).map((p) => ({
      ...p,
      notas: null,
      motivo_consulta: null,
      codigo_diagnostico: null,
      gravedad_estimada: null,
      fecha_inicio_tratamiento: null,
    })) as Paciente[]
  } else {
    const { data, count } = await supabase
      .from('pacientes')
      .select('*', { count: 'exact' })
      .eq('terapeuta_id', efectivo.terapeutaId)
      .order('apellido')
      .range(from, to)
    pacientes = data
    totalCount = count ?? 0
  }

  const ultimaCitaMap = new Map<string, string>()
  for (const t of turnos ?? []) {
    if (!ultimaCitaMap.has(t.paciente_id)) {
      ultimaCitaMap.set(t.paciente_id, t.fecha_hora)
    }
  }

  const pacientesListado = (pacientes ?? []).map((p) => ({
    ...p,
    ultima_cita: ultimaCitaMap.get(p.id) ?? null,
  }))

  return (
    <ListaPacientes
      pacientes={pacientesListado}
      profile={profile}
      totalCount={totalCount ?? 0}
      currentPage={pageNum}
      pageSize={PAGE_SIZE}
    />
  )
}
