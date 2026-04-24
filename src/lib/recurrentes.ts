import { addDays, addMinutes, getDay, startOfDay } from 'date-fns'

// Combina una fecha (sin hora) con un string "HH:MM"
function combineDateAndTime(date: Date, hora: string): Date {
  const [hours, minutes] = hora.split(':').map(Number)
  const result = startOfDay(new Date(date))
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Genera todas las fechas de una serie recurrente semanal.
 * Devuelve cada ocurrencia del diaSemana dado entre fechaInicio y fechaFin (inclusive).
 * diaSemana: 0 = domingo … 6 = sábado (mismo criterio que Date.getDay())
 */
export function generarFechasSerie(
  diaSemana: number,
  fechaInicio: Date,
  fechaFin: Date
): Date[] {
  const fechas: Date[] = []

  // Avanzar hasta la primera ocurrencia del día pedido >= fechaInicio
  const inicio = startOfDay(new Date(fechaInicio))
  const fin = startOfDay(new Date(fechaFin))
  const diff = (diaSemana - getDay(inicio) + 7) % 7
  let current = addDays(inicio, diff)

  while (current <= fin) {
    fechas.push(new Date(current))
    current = addDays(current, 7)
  }

  return fechas
}

/**
 * Detecta qué fechas de la serie colisionan con turnos existentes del profesional.
 * Un conflicto existe cuando los rangos [propuesto_inicio, propuesto_fin) y
 * [existente_inicio, existente_fin) se superponen.
 * Solo considera turnos que NO están cancelados.
 */
export async function detectarConflictos(
  terapeutaId: string,
  fechas: Date[],
  hora: string,
  duracion: number,
  supabase: any
): Promise<Date[]> {
  if (fechas.length === 0) return []

  const sorted = [...fechas].sort((a, b) => a.getTime() - b.getTime())

  // Rango mínimo necesario para la consulta
  const rangeDesde = combineDateAndTime(sorted[0], '00:00').toISOString()
  const rangeHasta = combineDateAndTime(sorted[sorted.length - 1], '23:59').toISOString()

  const { data: existentes, error } = await supabase
    .from('turnos')
    .select('fecha_hora, duracion_min')
    .eq('terapeuta_id', terapeutaId)
    .neq('estado', 'cancelado')
    .gte('fecha_hora', rangeDesde)
    .lte('fecha_hora', rangeHasta)

  if (error) throw new Error(error.message)
  if (!existentes || existentes.length === 0) return []

  return fechas.filter((fecha) => {
    const propInicio = combineDateAndTime(fecha, hora)
    const propFin = addMinutes(propInicio, duracion)

    return existentes.some((t: { fecha_hora: string; duracion_min: number }) => {
      const exInicio = new Date(t.fecha_hora)
      const exFin = addMinutes(exInicio, t.duracion_min)
      // Superposición: el existente empieza antes de que termine el propuesto
      // Y el existente termina después de que empiece el propuesto
      return exInicio < propFin && exFin > propInicio
    })
  })
}

/**
 * Inserta en bulk todos los turnos de la serie.
 * Las fechas recibidas ya deben tener filtrados los conflictos si el usuario
 * eligió omitirlos (pasar solo las fechas que se quieren crear).
 * Lanza un Error si la inserción falla.
 */
export async function crearSerieTurnos(
  recurrenteId: string,
  terapeutaId: string,
  pacienteId: string,
  fechas: Date[],
  hora: string,
  duracion: number,
  monto: number | null,
  supabase: any
): Promise<void> {
  if (fechas.length === 0) return

  const rows = fechas.map((fecha) => ({
    serie_recurrente_id: recurrenteId,
    terapeuta_id: terapeutaId,
    paciente_id: pacienteId,
    fecha_hora: combineDateAndTime(fecha, hora).toISOString(),
    duracion_min: duracion,
    monto,
    estado: 'pendiente' as const,
    pagado: false,
    recordatorio_enviado: false,
  }))

  const { error } = await supabase.from('turnos').insert(rows)
  if (error) throw new Error(error.message)
}
