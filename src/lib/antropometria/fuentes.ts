// Fuente (autor) de cada corte/fórmula que usa el informe profesional. Requisito de la
// nutricionista: "siempre que se usan cortes, se pone cuál es el autor". Solo datos —
// no se usan como fuente visible los comentarios de origen que ya existen en otras
// constantes del repo (p. ej. "copiados de ISAKMetry" en RANGOS_MUSCULO_OSEO).
export type ClaveFuente =
  | 'tejidoAdiposo' | 'tejidoMuscular' | 'tejidoOseo' | 'somatotipo' | 'conicidad' | 'imc' | 'cinturaCaderaOms'
  | 'cinturaCaderaPorEdad' | 'musculoOseo' | 'cormico' | 'manouvrier' | 'cinturaTalla'

export const FUENTES: Record<ClaveFuente, string | null> = {
  tejidoAdiposo: 'Kerr (1991)',
  tejidoMuscular: 'Lee (2000)',
  tejidoOseo: 'Rocha (1974)',
  somatotipo: 'Heath-Carter',
  // Decisión cerrada con la nutricionista: los cortes por sexo (M 1,25 / F 1,18) son de
  // Pitanga y Lessa (2004) — riesgo coronario en adultos de Salvador, Brasil.
  conicidad: 'Fórmula: Valdez (1991) · Cortes: Pitanga y Lessa (2004)',
  imc: 'OMS',
  cinturaCaderaOms: 'OMS (F <0,85, M <0,90)',
  // PENDIENTE: autor a confirmar con la nutricionista
  cinturaCaderaPorEdad: null,
  // PENDIENTE: autor a confirmar con la nutricionista
  musculoOseo: null,
  // PENDIENTE: autor a confirmar con la nutricionista
  cormico: null,
  // PENDIENTE: autor a confirmar con la nutricionista
  manouvrier: null,
  // PENDIENTE: autor a confirmar con la nutricionista
  cinturaTalla: null,
}

export function fuenteDe(clave: ClaveFuente): string | null {
  return FUENTES[clave]
}
