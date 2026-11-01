// Aritmética de fechas calendario puras (strings 'YYYY-MM-DD'), sin
// conversión de timezone — una vez que ya tenemos la fecha civil (ej. desde
// hoyFechaAR() o fecha_local de un registro), sumar/restar días o encontrar
// el lunes de la semana no depende de dónde corre el proceso. Siempre vía
// Date.UTC para no pisar un día por el huso horario del server.
const DIAS_VALUE = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function parse(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function format(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function sumarDias(fecha: string, n: number): string {
  const d = parse(fecha)
  d.setUTCDate(d.getUTCDate() + n)
  return format(d)
}

// Lunes de la semana que contiene `fecha` (getUTCDay: 0=domingo..6=sábado).
export function lunesDe(fecha: string): string {
  const dow = parse(fecha).getUTCDay()
  const offset = dow === 0 ? -6 : 1 - dow
  return sumarDias(fecha, offset)
}

export function rangoSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

// Mismo set de valores que el CHECK de plan_comidas.dia_semana.
export function diaSemanaKey(fecha: string): string {
  return DIAS_VALUE[parse(fecha).getUTCDay()]
}
