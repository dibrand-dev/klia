import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgendaSemanal from '@/components/agenda/AgendaSemanal'
import { startOfWeek, endOfWeek } from 'date-fns'
import type { Turno, Entrevista } from '@/types/database'
import { format } from 'date-fns'
import { getAuthenticatedClient, obtenerEventosGoogle } from '@/lib/google-calendar'

export const metadata = { title: 'Agenda — KLIA' }

export default async function AgendaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const ahora = new Date()
  const inicioSemana = startOfWeek(ahora, { weekStartsOn: 1 })
  const finSemana = endOfWeek(ahora, { weekStartsOn: 1 })

  const inicioStr = format(inicioSemana, 'yyyy-MM-dd')
  const finStr = format(finSemana, 'yyyy-MM-dd')

  const [{ data: profile }, { data: turnos }, { data: pacientes }, { data: googleTokens }, { data: entrevistas }] = await Promise.all([
    supabase.from('profiles').select('agenda_hora_inicio, agenda_hora_fin').eq('id', user.id).single(),
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
    supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('terapeuta_id', user.id)
      .eq('sync_enabled', true)
      .maybeSingle(),
    supabase
      .from('entrevistas')
      .select('*')
      .eq('terapeuta_id', user.id)
      .gte('fecha', inicioStr)
      .lte('fecha', finStr)
      .neq('estado', 'cancelada'),
  ])

  let googleEventsIniciales: { id: string; titulo: string; inicio: string; fin: string }[] = []
  let googleEventsDiaCompletosIniciales: { id: string; titulo: string; fecha: string }[] = []
  if (googleTokens) {
    try {
      const calendarClient = await getAuthenticatedClient(googleTokens)
      const tresMesesAtras = new Date()
      tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3)
      tresMesesAtras.setHours(0, 0, 0, 0)
      const tresMesesAdelante = new Date()
      tresMesesAdelante.setMonth(tresMesesAdelante.getMonth() + 3)
      tresMesesAdelante.setHours(23, 59, 59, 999)
      const { eventosConHora, eventosDiaCompleto } = await obtenerEventosGoogle(calendarClient, tresMesesAtras, tresMesesAdelante, googleTokens.calendar_id || 'primary')
      googleEventsIniciales = eventosConHora.map((e) => ({
        ...e,
        inicio: e.inicio.toISOString(),
        fin: e.fin.toISOString(),
      }))
      googleEventsDiaCompletosIniciales = eventosDiaCompleto
    } catch {
      // Google Calendar fetch errors are non-fatal
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      <AgendaSemanal
        turnosIniciales={(turnos ?? []) as unknown as Turno[]}
        pacientes={pacientes ?? []}
        terapeutaId={user.id}
        googleConnected={!!googleTokens}
        googleEventsIniciales={googleEventsIniciales}
        googleEventsDiaCompletosIniciales={googleEventsDiaCompletosIniciales}
        entrevistasIniciales={(entrevistas ?? []) as Entrevista[]}
        horaInicio={profile?.agenda_hora_inicio ?? 7}
        horaFin={profile?.agenda_hora_fin ?? 21}
      />
    </div>
  )
}
