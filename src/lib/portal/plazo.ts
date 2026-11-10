// Argentina sin horario de verano — UTC-3 fijo, mismo criterio que src/lib/tz.ts.
const AR_OFFSET_MS = 3 * 60 * 60 * 1000

// Regla de plazo del registro de comidas del portal: una comida se puede
// registrar hasta 48 h DESPUÉS DE SU HORA EN EL PLAN (no 48 h desde ahora
// mirando hacia atrás) — ej. el desayuno de hace 3 días a las 08:00 ya no se
// puede registrar, pero la cena de ayer a las 21:00 sí, si todavía no
// pasaron 48 h desde esa hora puntual. El registro en sí llega en la Fase
// 2C — este helper ya se usa en la 2B para los banners de Hoy (solo lectura
// / plazo parcial) y el estado de cada fila.
//
// fecha/hora son valores civiles en hora Argentina (plan_comidas.hora no
// lleva timezone) — nunca construir el Date con el constructor de
// componentes sueltos (interpreta en la hora local del proceso, UTC en
// Vercel): hay que sumar el offset para obtener el instante UTC real.
export function estaEnPlazo(fecha: string, hora: string | null, ahora: Date): boolean {
  const [y, m, d] = fecha.split('-').map(Number)
  const [hh, mm] = (hora ?? '00:00').split(':').map(Number)
  const momentoComidaUTC = Date.UTC(y, m - 1, d, hh, mm, 0, 0) + AR_OFFSET_MS
  const horasTranscurridas = (ahora.getTime() - momentoComidaUTC) / 36e5
  return horasTranscurridas <= 48
}

// Plazo del registro en modo libre (sin plan, o sin comidas de plan ese
// día): no hay una hora de comida de la que contar 48 h, así que el plazo
// es fijo por fecha civil — se puede registrar hasta el fin del día
// SIGUIENTE a `fecha` (23:59:59.999 hora Argentina). Ej.: una comida libre
// del lunes se puede cargar hasta las 23:59:59 del martes; a partir de las
// 00:00:00 del miércoles ya quedó fuera de plazo.
export function estaEnPlazoLibre(fecha: string, ahora: Date): boolean {
  const [y, m, d] = fecha.split('-').map(Number)
  // Date.UTC con día `d + 1` normaliza el mes/año automáticamente (cambio de
  // mes o de año incluido) — mismo truco que sumarDias en semana.ts.
  const finDelDiaSiguienteUTC = Date.UTC(y, m - 1, d + 1, 23, 59, 59, 999) + AR_OFFSET_MS
  return ahora.getTime() <= finDelDiaSiguienteUTC
}
