import { parseISO, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'

// TODO: leer de profiles.timezone cuando haya profesionales fuera de Argentina
export const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires'

// parseISO + format de date-fns, sin más, formatea en la zona horaria del
// proceso que corre el código (UTC en Vercel) — no en Argentina. Para
// cualquier fecha_hora que se muestre a un paciente (email, pantalla de
// confirmación) hay que convertir primero con toZonedTime + ARGENTINA_TZ.
// Centralizado acá para no repetir parseISO+format suelto en cada archivo.
export function formatFechaHoraArgentina(fechaISO: string, formato: 'fecha' | 'hora' | 'completo'): string {
  const local = zonedDateArgentina(fechaISO)
  if (formato === 'fecha') return format(local, "EEEE d 'de' MMMM yyyy", { locale: es })
  if (formato === 'hora') return format(local, 'HH:mm')
  return format(local, "EEEE d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })
}

// Para callers que necesitan un format() propio (ej. sin año) pero igual
// necesitan partir de la fecha ya convertida a ART, no de la hora cruda del
// proceso.
export function zonedDateArgentina(fechaISO: string): Date {
  return toZonedTime(parseISO(fechaISO), ARGENTINA_TZ)
}
