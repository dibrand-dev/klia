// Resolución del turno al que corresponde una medición antropométrica cargada "a mano"
// (NuevoRegistroSlide), para que HistorialList pueda emparejarla por turno_id con la
// sesión del día. Librería pura: sin dependencias, sin I/O.

const AR_OFFSET_MS = 3 * 60 * 60 * 1000 // Argentina: UTC-3, sin horario de verano desde 2009.

/** Día calendario en America/Argentina/Buenos_Aires ('YYYY-MM-DD') de un timestamp UTC. */
export function diaCalendarioAR(isoUtc: string): string {
  return new Date(new Date(isoUtc).getTime() - AR_OFFSET_MS).toISOString().slice(0, 10)
}

/** Rango UTC [desde, hasta) que cubre exactamente un día calendario AR — para acotar la
 * query de turnos a ese día sin tener que traer todo el historial del paciente. */
export function rangoDiaCalendarioAR(fechaAR: string): { desde: string; hasta: string } {
  const inicioUTC = new Date(`${fechaAR}T00:00:00.000Z`).getTime() + AR_OFFSET_MS
  return {
    desde: new Date(inicioUTC).toISOString(),
    hasta: new Date(inicioUTC + 24 * 60 * 60 * 1000).toISOString(),
  }
}

export interface TurnoCandidato {
  id: string
  fecha_hora: string
  estado: string
}

/**
 * Turno al que corresponde un registro antropométrico cargado a mano, por fecha del
 * registro (no por la hora actual) — se asume que `turnos` ya viene filtrado por paciente.
 *
 * - Candidatos: mismo día calendario AR que `fechaRegistro`, estado != 'cancelado', y no
 *   en `turnoIdsOcupados` (turnos que ya tienen OTRO registro antropométrico propio —
 *   HistorialList empareja 1 a 1 por turno_id, así que un turno ocupado no sirve).
 * - 0 candidatos → null. 1 candidato → ese.
 * - Varios: solo si `fechaRegistro` es el día de hoy (AR, según `ahora`) se elige el más
 *   cercano a `ahora`; si no es hoy, o hay empate de distancia, null — nunca se adivina.
 */
export function resolverTurnoParaRegistro(
  turnos: TurnoCandidato[],
  fechaRegistro: string,
  turnoIdsOcupados: Set<string>,
  ahora: Date,
): string | null {
  const candidatos = turnos.filter((t) =>
    t.estado !== 'cancelado' && !turnoIdsOcupados.has(t.id) && diaCalendarioAR(t.fecha_hora) === fechaRegistro
  )
  if (candidatos.length === 0) return null
  if (candidatos.length === 1) return candidatos[0].id

  if (diaCalendarioAR(ahora.toISOString()) !== fechaRegistro) return null

  const ahoraMs = ahora.getTime()
  let mejor: TurnoCandidato | null = null
  let mejorDist = Infinity
  let empatado = false
  for (const t of candidatos) {
    const dist = Math.abs(new Date(t.fecha_hora).getTime() - ahoraMs)
    if (dist < mejorDist) {
      mejor = t; mejorDist = dist; empatado = false
    } else if (dist === mejorDist) {
      empatado = true
    }
  }
  return !empatado && mejor ? mejor.id : null
}
