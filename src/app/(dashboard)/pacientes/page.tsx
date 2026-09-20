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
const ULTIMA_CITA_VALORES = ['7', '30', '60', 'sin_consultas'] as const
type UltimaCitaFiltro = (typeof ULTIMA_CITA_VALORES)[number]

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: { page?: string; estado?: string; ultima_cita?: string }
}) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const pageNum = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const estadoParam = searchParams.estado === 'activo' || searchParams.estado === 'inactivo' ? searchParams.estado : null
  const activoFilter = estadoParam === 'activo' ? true : estadoParam === 'inactivo' ? false : null
  const ultimaCitaParam = (ULTIMA_CITA_VALORES as readonly string[]).includes(searchParams.ultima_cita ?? '')
    ? (searchParams.ultima_cita as UltimaCitaFiltro)
    : null

  let pacientesBase: Paciente[]

  const ahoraISO = new Date().toISOString()

  const [{ data: profile }, { data: turnosPasados }, { data: turnosFuturos }] = await Promise.all([
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
    supabase
      .from('turnos')
      .select('paciente_id, fecha_hora')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .gte('fecha_hora', ahoraISO)
      .not('estado', 'in', '("cancelado")')
      .order('fecha_hora', { ascending: true }),
  ])

  if (efectivo.esColaborador) {
    // La colaboradora no tiene policy de SELECT directa sobre `pacientes`
    // (a propósito, por las columnas clínicas) — su acceso pasa por esta
    // función, que sí valida la colaboración activa server-side.
    const { data: todosPacientesRaw } = await supabase.rpc('get_pacientes_colaborador')
    const todosPacientesRPC = (todosPacientesRaw ?? []) as PacienteColaboradorRow[]
    // Filtro de estado ANTES de calcular ultima_cita/orden — el RPC no acepta
    // filtros server-side, así que hay que aplicarlo acá.
    const filtradosPorEstado = activoFilter === null
      ? todosPacientesRPC
      : todosPacientesRPC.filter((p) => p.activo === activoFilter)
    pacientesBase = filtradosPorEstado.map((p) => ({
      ...p,
      notas: null,
      motivo_consulta: null,
      codigo_diagnostico: null,
      gravedad_estimada: null,
      fecha_inicio_tratamiento: null,
    })) as Paciente[]
  } else {
    // Sin .range() acá: traemos TODOS los pacientes filtrados por estado — el corte
    // a la página actual pasa a hacerse en memoria, después de calcular ultima_cita/
    // proxima_sesion y aplicar el nuevo orden (sin actividad primero). Paginar en la
    // base antes de eso daría páginas inconsistentes con el orden real.
    let query = supabase
      .from('pacientes')
      .select('*')
      .eq('terapeuta_id', efectivo.terapeutaId)
    if (activoFilter !== null) query = query.eq('activo', activoFilter)
    const { data } = await query
    pacientesBase = data ?? []
  }

  const ultimaCitaMap = new Map<string, string>()
  for (const t of turnosPasados ?? []) {
    if (!ultimaCitaMap.has(t.paciente_id)) {
      ultimaCitaMap.set(t.paciente_id, t.fecha_hora)
    }
  }

  const proximaSesionMap = new Map<string, string>()
  for (const t of turnosFuturos ?? []) {
    if (!proximaSesionMap.has(t.paciente_id)) {
      proximaSesionMap.set(t.paciente_id, t.fecha_hora)
    }
  }

  const conActividad = pacientesBase.map((p) => ({
    ...p,
    ultima_cita: ultimaCitaMap.get(p.id) ?? null,
    proxima_sesion: proximaSesionMap.get(p.id) ?? null,
  }))

  // Filtro de "Última Cita" — se calcula sobre ultima_cita (derivado de turnos, no
  // una columna de pacientes), así que solo puede aplicarse acá, en memoria, después
  // de tener el dato calculado — no hay forma de resolverlo con un .eq()/.gte() en
  // la query de pacientes.
  const ahoraMs = Date.now()
  function diasDesde(fechaISO: string): number {
    return Math.floor((ahoraMs - new Date(fechaISO).getTime()) / (24 * 60 * 60 * 1000))
  }

  const filtradosPorUltimaCita = ultimaCitaParam === null
    ? conActividad
    : conActividad.filter((p) => {
        if (ultimaCitaParam === 'sin_consultas') return p.ultima_cita === null
        if (p.ultima_cita === null) return false
        const dias = diasDesde(p.ultima_cita)
        if (ultimaCitaParam === '7') return dias <= 7
        if (ultimaCitaParam === '30') return dias <= 30
        if (ultimaCitaParam === '60') return dias > 60
        return true
      })

  // Orden: sin ninguna consulta registrada primero (son los que más necesitan
  // atención/seguimiento), después por ultima_cita descendente (más reciente arriba).
  const ordenados = [...filtradosPorUltimaCita].sort((a, b) => {
    if (a.ultima_cita === null && b.ultima_cita === null) return 0
    if (a.ultima_cita === null) return -1
    if (b.ultima_cita === null) return 1
    return new Date(b.ultima_cita).getTime() - new Date(a.ultima_cita).getTime()
  })

  const totalCount = ordenados.length
  const pacientesListado = ordenados.slice(from, to + 1)

  return (
    <ListaPacientes
      pacientes={pacientesListado}
      profile={profile}
      totalCount={totalCount}
      currentPage={pageNum}
      pageSize={PAGE_SIZE}
      estadoActual={estadoParam ?? ''}
      ultimaCitaActual={ultimaCitaParam ?? ''}
    />
  )
}
