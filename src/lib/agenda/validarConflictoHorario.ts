import type { SupabaseClient } from '@supabase/supabase-js'

// Detecta si un horario (fecha + hora + duración, en hora de Argentina) pisa un
// turno o una entrevista existentes del profesional. Lo usan el alta de turno
// (NuevoTurnoPageForm) y la edición (TurnoDetalleModal) para ofrecer agendar
// como sobreturno — el trigger check_turno_overlap de la base solo deja pasar
// los turnos marcados con es_sobreturno.

const ART = '-03:00'

export type ConflictoHorario = { hayConflicto: boolean; mensaje?: string }

type Params = {
  terapeutaId: string
  fecha: string // yyyy-MM-dd
  hora: string // HH:mm
  duracion: number
  /** Turno que se está editando — no puede chocar consigo mismo. */
  excluirTurnoId?: string
  /** Resuelve el nombre desde una lista ya cargada (si no, se usa el join). */
  resolverNombrePaciente?: (pacienteId: string) => string | null
}

type TurnoExistente = {
  id: string
  fecha_hora: string
  duracion_min: number | null
  estado: string
  paciente_id: string
  paciente: { nombre: string; apellido: string } | { nombre: string; apellido: string }[] | null
}

export async function validarConflictoHorario(
  supabase: SupabaseClient,
  { terapeutaId, fecha, hora, duracion, excluirTurnoId, resolverNombrePaciente }: Params,
): Promise<ConflictoHorario> {
  const newStart = new Date(`${fecha}T${hora}:00${ART}`)
  const newEnd = new Date(newStart.getTime() + (duracion || 50) * 60 * 1000)

  // Día completo en hora argentina (no UTC): un turno a las 22:00 ART cae en el
  // día siguiente en UTC y se perdería con límites `T00:00Z`–`T23:59Z`.
  const dayStart = new Date(`${fecha}T00:00:00.000${ART}`).toISOString()
  const dayEnd = new Date(`${fecha}T23:59:59.999${ART}`).toISOString()

  let turnosQuery = supabase
    .from('turnos')
    .select('id, fecha_hora, duracion_min, estado, paciente_id, paciente:pacientes(nombre, apellido)')
    .eq('terapeuta_id', terapeutaId)
    .gte('fecha_hora', dayStart)
    .lte('fecha_hora', dayEnd)
    .not('estado', 'eq', 'cancelado')
  if (excluirTurnoId) turnosQuery = turnosQuery.neq('id', excluirTurnoId)

  const [{ data: turnosExistentes }, { data: entrevistasExistentes }] = await Promise.all([
    turnosQuery,
    supabase
      .from('entrevistas')
      .select('id, hora, duracion, nombre, apellido')
      .eq('terapeuta_id', terapeutaId)
      .eq('fecha', fecha)
      .not('estado', 'eq', 'cancelada'),
  ])

  const turnoConflicto = ((turnosExistentes ?? []) as unknown as TurnoExistente[]).find((t) => {
    const tStart = new Date(t.fecha_hora)
    const tEnd = new Date(tStart.getTime() + (t.duracion_min ?? 50) * 60 * 1000)
    return newStart < tEnd && newEnd > tStart
  })

  if (turnoConflicto) {
    const embebido = Array.isArray(turnoConflicto.paciente) ? turnoConflicto.paciente[0] : turnoConflicto.paciente
    const nombre =
      resolverNombrePaciente?.(turnoConflicto.paciente_id) ??
      (embebido ? `${embebido.nombre} ${embebido.apellido}` : 'otro paciente')
    const esPendientePago = turnoConflicto.estado === 'pendiente'
    return {
      hayConflicto: true,
      mensaje: esPendientePago
        ? `Este horario está reservado para ${nombre} con pago pendiente. Se liberará automáticamente si no se abona en el tiempo configurado.`
        : `Este horario ya está ocupado por ${nombre}. Por favor elegí otro horario.`,
    }
  }

  const entrevistaConflicto = (entrevistasExistentes ?? []).find((e) => {
    const eStart = new Date(`${fecha}T${e.hora}:00${ART}`)
    const eEnd = new Date(eStart.getTime() + (e.duracion ?? 50) * 60 * 1000)
    return newStart < eEnd && newEnd > eStart
  })

  if (entrevistaConflicto) {
    return {
      hayConflicto: true,
      mensaje: `Este horario ya tiene una entrevista con ${entrevistaConflicto.nombre} ${entrevistaConflicto.apellido}. Por favor elegí otro horario.`,
    }
  }

  return { hayConflicto: false }
}
