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

// Diferencia en días calendario entre dos fechas (a - b), sin horas de por
// medio — para "off(d)" del portal (hoy=0, ayer=1, etc.).
export function diffDias(a: string, b: string): number {
  const MS_POR_DIA = 86400000
  return Math.round((parse(a).getTime() - parse(b).getTime()) / MS_POR_DIA)
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

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function diaCortoYNumero(fecha: string): { diaCorto: string; numero: number } {
  const [, m, d] = fecha.split('-').map(Number)
  return { diaCorto: DIA_CORTO[parse(fecha).getUTCDay()], numero: d }
}

export function formatCorto(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number)
  return `${d} ${MES_CORTO[m - 1]}`
}

export function formatLargo(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number)
  return `${DIA_LARGO[parse(fecha).getUTCDay()]} ${d} de ${MES_LARGO[m - 1]}`
}
