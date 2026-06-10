import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ListaPacientes from '@/components/pacientes/ListaPacientes'

export const metadata = { title: 'Pacientes — KLIA' }

const PAGE_SIZE = 12

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const pageNum = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const [{ data: pacientes, count: totalCount }, { data: profile }, { data: turnos }] = await Promise.all([
    supabase
      .from('pacientes')
      .select('*', { count: 'exact' })
      .eq('terapeuta_id', user.id)
      .order('apellido')
      .range(from, to),
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('turnos')
      .select('paciente_id, fecha_hora')
      .eq('terapeuta_id', user.id)
      .eq('estado', 'realizado')
      .order('fecha_hora', { ascending: false }),
  ])

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
