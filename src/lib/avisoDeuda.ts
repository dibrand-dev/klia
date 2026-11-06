export type AvisoDeudaTiming = 'nunca' | '24h' | '48h' | '72h' | '7dias' | 'fin_mes'

const HORAS_POR_TIMING: Record<'24h' | '48h' | '72h' | '7dias', number> = {
  '24h': 24,
  '48h': 48,
  '72h': 72,
  '7dias': 7 * 24,
}

// Fin real de la sesión: si quedó registrado por el flujo de sala de espera
// (fin_real_at), ese dato manda; si no, se estima con lo programado
// (fecha_hora + duracion_min).
export function calcularFinSesion(turno: { fecha_hora: string; duracion_min: number; fin_real_at: string | null }): Date {
  if (turno.fin_real_at) return new Date(turno.fin_real_at)
  return new Date(new Date(turno.fecha_hora).getTime() + turno.duracion_min * 60 * 1000)
}

// Argentina es UTC-3 todo el año (sin horario de verano), así que 09:00 ART
// equivale siempre a 12:00 UTC — no hace falta resolver el offset real.
function finDeMesART(finSesion: Date): Date {
  const mesAR = new Date(finSesion.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const ultimoDia = new Date(mesAR.getFullYear(), mesAR.getMonth() + 1, 0)
  return new Date(Date.UTC(ultimoDia.getFullYear(), ultimoDia.getMonth(), ultimoDia.getDate(), 12, 0, 0))
}

// null si el profesional eligió 'nunca' — el caller filtra ese caso antes de
// llegar hasta aquí, pero devolver null en vez de una fecha arbitraria evita
// que un error de ese filtro dispare un envío.
export function calcularFechaAvisoDeuda(finSesion: Date, timing: AvisoDeudaTiming): Date | null {
  if (timing === 'nunca') return null
  if (timing === 'fin_mes') return finDeMesART(finSesion)
  return new Date(finSesion.getTime() + HORAS_POR_TIMING[timing] * 60 * 60 * 1000)
}
