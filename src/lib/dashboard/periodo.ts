// Cálculo de rangos de período y de comparación para el Dashboard.
// Todo en fechas calendario ART (strings 'YYYY-MM-DD'), sin componente de
// hora — coincide con lo que esperan las RPCs dashboard_resumen /
// dashboard_serie_mensual (parámetros `date`, no timestamp). La aritmética
// usa Date.UTC para no depender del timezone del proceso Node.

export type PeriodoPreset = 'hoy' | 'semana' | 'mes' | 'mesant' | '3m' | 'anio' | 'custom'
export type Comparacion = 'prev' | 'yoy'

export interface RangoFechas {
  desde: string
  hasta: string
}

function toUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(dateStr: string, days: number): string {
  const d = toUTC(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return fmt(d)
}

function diasEnMes(anio: number, mesIdx0: number): number {
  return new Date(Date.UTC(anio, mesIdx0 + 1, 0)).getUTCDate()
}

export function shiftMonths(dateStr: string, deltaMeses: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const idx = (m - 1) + deltaMeses
  const newY = y + Math.floor(idx / 12)
  const newM = ((idx % 12) + 12) % 12
  const dia = Math.min(d, diasEnMes(newY, newM))
  return fmt(new Date(Date.UTC(newY, newM, dia)))
}

export function shiftYears(dateStr: string, deltaAnios: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const newY = y + deltaAnios
  const dia = Math.min(d, diasEnMes(newY, m - 1))
  return fmt(new Date(Date.UTC(newY, m - 1, dia)))
}

export function startOfMonthStr(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number)
  return fmt(new Date(Date.UTC(y, m - 1, 1)))
}

export function endOfMonthStr(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number)
  return fmt(new Date(Date.UTC(y, m, 0)))
}

function startOfWeekMonday(dateStr: string): string {
  const d = toUTC(dateStr)
  const dow = d.getUTCDay() // 0=domingo
  const diff = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - diff)
  return fmt(d)
}

export function diffDays(desde: string, hasta: string): number {
  return Math.round((toUTC(hasta).getTime() - toUTC(desde).getTime()) / 86400000)
}

export function clampStr(a: string, b: string): string {
  return a < b ? a : b
}

export function resolverPeriodo(
  preset: PeriodoPreset,
  hoyArgStr: string,
  customDesde?: string,
  customHasta?: string,
): RangoFechas {
  switch (preset) {
    case 'hoy':
      return { desde: hoyArgStr, hasta: hoyArgStr }
    case 'semana': {
      const desde = startOfWeekMonday(hoyArgStr)
      return { desde, hasta: addDays(desde, 6) }
    }
    case 'mes':
      return { desde: startOfMonthStr(hoyArgStr), hasta: endOfMonthStr(hoyArgStr) }
    case 'mesant': {
      const ultimoDiaMesAnterior = addDays(startOfMonthStr(hoyArgStr), -1)
      return { desde: startOfMonthStr(ultimoDiaMesAnterior), hasta: ultimoDiaMesAnterior }
    }
    case '3m':
      return { desde: startOfMonthStr(shiftMonths(hoyArgStr, -2)), hasta: hoyArgStr }
    case 'anio':
      return { desde: `${hoyArgStr.slice(0, 4)}-01-01`, hasta: hoyArgStr }
    case 'custom': {
      const desde = customDesde || hoyArgStr
      const hasta = customHasta || hoyArgStr
      return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde }
    }
  }
}

// Período anterior "de igual tramo": desplaza el período una unidad de
// calendario propia del preset hacia atrás (semana→-7d, mes→-1 mes,
// año→-1 año) y lo recorta a los mismos días ya transcurridos del período
// actual — así "Este mes" (1..N, hoy=día N) compara contra "1..N del mes
// anterior", no contra los N días inmediatamente previos al día 1.
export function resolverComparacion(
  cmp: Comparacion,
  preset: PeriodoPreset,
  rango: RangoFechas,
  hoyArgStr: string,
): RangoFechas & { label: string } {
  if (cmp === 'yoy') {
    return { desde: shiftYears(rango.desde, -1), hasta: shiftYears(rango.hasta, -1), label: 'Mismo período del año anterior' }
  }

  const finTranscurrido = clampStr(rango.hasta, hoyArgStr)
  const diasTranscurridos = diffDays(rango.desde, finTranscurrido) + 1

  let cmpDesde: string
  if (preset === 'custom' || preset === 'hoy') {
    const cmpHasta = addDays(rango.desde, -1)
    cmpDesde = addDays(cmpHasta, -(diasTranscurridos - 1))
    return { desde: cmpDesde, hasta: cmpHasta, label: 'Período anterior' }
  }

  if (preset === 'semana') cmpDesde = addDays(rango.desde, -7)
  else if (preset === '3m') cmpDesde = shiftMonths(rango.desde, -3)
  else if (preset === 'anio') cmpDesde = shiftYears(rango.desde, -1)
  else cmpDesde = shiftMonths(rango.desde, -1) // 'mes' | 'mesant'

  return { desde: cmpDesde, hasta: addDays(cmpDesde, diasTranscurridos - 1), label: 'Período anterior' }
}

export const PRESET_LABELS: Record<PeriodoPreset, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  mes: 'Este mes',
  mesant: 'Mes anterior',
  '3m': 'Últimos 3 meses',
  anio: 'Este año',
  custom: 'Personalizado',
}
