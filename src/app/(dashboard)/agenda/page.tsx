import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgendaSemanal from '@/components/agenda/AgendaSemanal'
import { startOfWeek, endOfWeek } from 'date-fns'
import type { Turno } from '@/types/database'

export const metadata = { title: 'Agenda — KLIA' }

export default async function AgendaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const ahora = new Date()
  const inicioSemana = startOfWeek(ahora, { weekStartsOn: 1 })
  const finSemana = endOfWeek(ahora, { weekStartsOn: 1 })

  const [{ data: turnos }, { data: pacientes }] = await Promise.all([
    supabase
      .from('turnos')
      .select('*, paciente:pacientes(*)')
      .eq('terapeuta_id', user.id)
      .gte('fecha_hora', inicioSemana.toISOString())
      .lte('fecha_hora', finSemana.toISOString())
      .order('fecha_hora'),
    supabase
      .from('pacientes')
      .select('*')
      .eq('terapeuta_id', user.id)
      .eq('activo', true)
      .order('apellido'),
  ])

  return (
    <div className="pt-4 md:pt-8">
      <AgendaSemanal
        turnosIniciales={(turnos ?? []) as unknown as Turno[]}
        pacientes={pacientes ?? []}
        terapeutaId={user.id}
      />
    </div>
  )
}
