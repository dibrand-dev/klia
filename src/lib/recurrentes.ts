import { addDays, addMinutes, format, getDay, startOfDay } from 'date-fns'

// Devuelve el N-ésimo día de la semana dentro de un mes (1-indexed)
function getNesimosDiaDelMes(año: number, mes: number, diaSemana: number, n: number): Date {
  const primerDia = new Date(año, mes, 1)
  const diasHastaTarget = (diaSemana - primerDia.getDay() + 7) % 7
  const primerOcurrencia = new Date(año, mes, 1 + diasHastaTarget)
  return new Date(año, mes, primerOcurrencia.getDate() + (n - 1) * 7)
}

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export type ConflictoDetallado = {
  fecha: Date
  horaConflicto: string // HH:mm del turno existente que choca
}

// Combina una fecha (sin hora) con un string "HH:MM"
function combineDateAndTime(date: Date, hora: string): Date {
  const [hours, minutes] = hora.split(':').map(Number)
  const result = startOfDay(new Date(date))
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Genera todas las fechas de una serie recurrente.
 * diaSemana: 0=domingo … 6=sábado (mismo criterio que Date.getDay())
 * frecuencia: 'semanal' | 'quincenal' | 'mensual'
 * semanaDelMes: para quincenal (1→1ra+3ra, 2→2da+4ta) y mensual (N-ésima semana)
 */
export function generarFechasSerie(
  diaSemana: number,
  fechaInicio: Date,
  fechaFin: Date,
  frecuencia: 'semanal' | 'quincenal' | 'mensual' = 'semanal',
  semanaDelMes?: number
): Date[] {
  const fechas: Date[] = []
  const inicio = startOfDay(new Date(fechaInicio))
  const fin = startOfDay(new Date(fechaFin))

  if (frecuencia === 'semanal') {
    const diff = (diaSemana - getDay(inicio) + 7) % 7
    let current = addDays(inicio, diff)
    while (current <= fin) {
      fechas.push(new Date(current))
      current = addDays(current, 7)
    }
    return fechas
  }

  const n1 = semanaDelMes ?? 1
  let año = inicio.getFullYear()
  let mes = inicio.getMonth()

  while (año < fin.getFullYear() || (año === fin.getFullYear() && mes <= fin.getMonth())) {
    const ns = frecuencia === 'quincenal' ? [n1, n1 + 2] : [n1]

    for (const n of ns) {
      const fecha = getNesimosDiaDelMes(año, mes, diaSemana, n)
      const d = startOfDay(fecha)
      if (d.getMonth() === mes && d >= inicio && d <= fin) {
        fechas.push(d)
      }
    }

    mes++
    if (mes > 11) { mes = 0; año++ }
  }

  return fechas.sort((a, b) => a.getTime() - b.getTime())
}

/**
 * Detecta conflictos (fechas, sin detalle). Para uso en creaciones nuevas.
 */
export async function detectarConflictos(
  terapeutaId: string,
  fechas: Date[],
  hora: string,
  duracion: number,
  supabase: any
): Promise<Date[]> {
  const result = await detectarConflictosDetallados(terapeutaId, fechas, hora, duracion, supabase)
  return result.map((c) => c.fecha)
}

/**
 * Detecta conflictos con detalle del horario del turno existente.
 * excludeSerieId: excluye turnos que pertenecen a esta serie (útil al editar).
 */
export async function detectarConflictosDetallados(
  terapeutaId: string,
  fechas: Date[],
  hora: string,
  duracion: number,
  supabase: any,
  excludeSerieId?: string
): Promise<ConflictoDetallado[]> {
  if (fechas.length === 0) return []

  const sorted = [...fechas].sort((a, b) => a.getTime() - b.getTime())
  const rangeDesde = combineDateAndTime(sorted[0], '00:00').toISOString()
  const rangeHasta = combineDateAndTime(sorted[sorted.length - 1], '23:59').toISOString()

  let query = supabase
    .from('turnos')
    .select('fecha_hora, duracion_min')
    .eq('terapeuta_id', terapeutaId)
    .neq('estado', 'cancelado')
    .gte('fecha_hora', rangeDesde)
    .lte('fecha_hora', rangeHasta)

  if (excludeSerieId) {
    query = query.neq('serie_recurrente_id', excludeSerieId)
  }

  const { data: existentes, error } = await query
  if (error) throw new Error(error.message)
  if (!existentes || existentes.length === 0) return []

  const conflictos: ConflictoDetallado[] = []

  for (const fecha of fechas) {
    const propInicio = combineDateAndTime(fecha, hora)
    const propFin = addMinutes(propInicio, duracion)

    for (const t of existentes as { fecha_hora: string; duracion_min: number }[]) {
      const exInicio = new Date(t.fecha_hora)
      const exFin = addMinutes(exInicio, t.duracion_min)
      if (exInicio < propFin && exFin > propInicio) {
        conflictos.push({
          fecha,
          horaConflicto: format(exInicio, 'HH:mm'),
        })
        break
      }
    }
  }

  return conflictos
}

/**
 * Crea el registro de la serie en turnos_recurrentes y devuelve su id.
 */
export async function crearRegistroSerie(
  terapeutaId: string,
  pacienteId: string,
  diaSemana: number,
  hora: string,
  duracion: number,
  modalidad: string,
  monto: number | null,
  fechaInicio: Date,
  fechaFin: Date,
  supabase: any,
  frecuencia: 'semanal' | 'quincenal' | 'mensual' = 'semanal',
  semanaDelMes?: number
): Promise<string> {
  const { data, error } = await supabase
    .from('turnos_recurrentes')
    .insert({
      terapeuta_id: terapeutaId,
      paciente_id: pacienteId,
      dia_semana: diaSemana,
      hora,
      duracion_min: duracion,
      modalidad,
      monto,
      fecha_inicio: format(fechaInicio, 'yyyy-MM-dd'),
      fecha_fin: format(fechaFin, 'yyyy-MM-dd'),
      activo: true,
      frecuencia,
      semana_del_mes: semanaDelMes ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`[turnos_recurrentes] ${error.message} | code: ${error.code} | details: ${error.details} | hint: ${error.hint}`)
  return data.id
}

/**
 * Inserta en bulk todos los turnos de la serie.
 * Las fechas recibidas ya deben ser las que se quieren crear (sin conflictos).
 */
export async function crearSerieTurnos(
  recurrenteId: string,
  terapeutaId: string,
  pacienteId: string,
  fechas: Date[],
  hora: string,
  duracion: number,
  modalidad: string,
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
    modalidad,
    monto,
    estado: 'pendiente' as const,
    pagado: false,
    recordatorio_enviado: false,
  }))

  const { error } = await supabase.from('turnos').insert(rows)
  if (error) throw new Error(error.message)
}
