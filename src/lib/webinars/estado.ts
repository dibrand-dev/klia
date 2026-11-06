export type EstadoRuntimeWebinar = 'open' | 'closed' | 'ended'

interface WebinarTiming {
  fecha_inicio: string
  duracion_min: number
  cierre_inscripcion: string
}

// Estado "en vivo" del webinar según el reloj, independiente de la columna
// `estado` (borrador/publicado/cancelado) de la tabla — esto decide si la
// inscripción sigue abierta, ya cerró, o el evento ya terminó.
export function estadoWebinar(w: WebinarTiming, ahora: Date = new Date()): EstadoRuntimeWebinar {
  const inicioMs = new Date(w.fecha_inicio).getTime()
  const finMs = inicioMs + w.duracion_min * 60 * 1000
  const cierreMs = new Date(w.cierre_inscripcion).getTime()
  const ahoraMs = ahora.getTime()

  if (ahoraMs >= finMs) return 'ended'
  if (ahoraMs >= cierreMs) return 'closed'
  return 'open'
}
