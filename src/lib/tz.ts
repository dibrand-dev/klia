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
