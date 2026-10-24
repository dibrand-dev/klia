// Argentina sin horario de verano — UTC-3 fijo, siempre.
const AR_OFFSET_MS = 3 * 60 * 60 * 1000

// Ventana [00:00, 23:59:59.999) del día de mañana en hora Argentina,
// expresada como instantes UTC reales — sin pasar por toLocaleString/Date
// local del servidor (fuente del bug: el server corre en UTC).
export function ventanaDiaSiguienteAR(now = new Date()) {
  const ar = new Date(now.getTime() - AR_OFFSET_MS)
  const y = ar.getUTCFullYear(), m = ar.getUTCMonth(), d = ar.getUTCDate() + 1
  const desde = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) + AR_OFFSET_MS)
  const hasta = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0) + AR_OFFSET_MS - 1)
  return { desde, hasta }
}

// Inicio del mes calendario actual en hora Argentina (00:00 del día 1),
// expresado como instante UTC real — mismo motivo que ventanaDiaSiguienteAR:
// evita toLocaleString/Date local del servidor (corre en UTC).
export function inicioMesActualAR(now = new Date()): Date {
  const ar = new Date(now.getTime() - AR_OFFSET_MS)
  const y = ar.getUTCFullYear(), m = ar.getUTCMonth()
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) + AR_OFFSET_MS)
}

// Fecha/hora legibles en hora Argentina para mails y respuestas de API —
// nunca date-fns format() en servidor (su locale 'es' no lleva timeZone y
// termina formateando en la hora del server, no en AR).
export function formatFechaHoraAR(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso)
  const fecha = d.toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const hora = d.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  return { fecha, hora }
}
