// Tabla de referencia cintura/cadera por sexo y década de edad (20–69 años).
// Solo datos + la clasificación mecánica de la tabla — no toca lo que devuelve
// `calcular()` en calculos.ts (que usa el corte OMS como su propio criterio de salud).
import type { Sexo } from './constantes'

export type CategoriaCinturaCadera = 'bajo' | 'moderado' | 'alto' | 'muy_alto'

export interface RangoCinturaCadera {
  decadaDesde: number
  decadaHasta: number
  /** Techo exclusivo de 'bajo' y de 'moderado'/'alto' (límites <, luego [desde,hasta]). */
  bajoHasta: number
  moderadoDesde: number
  moderadoHasta: number
  altoDesde: number
  altoHasta: number
  muyAltoDesde: number
}

// Mujeres (bajo / moderado / alto / muy alto):
// 20–29 <0,71 / 0,71–0,77 / 0,78–0,82 / >0,82
// 30–39 <0,72 / 0,72–0,78 / 0,79–0,84 / >0,84
// 40–49 <0,73 / 0,73–0,79 / 0,80–0,87 / >0,87
// 50–59 <0,74 / 0,74–0,81 / 0,82–0,88 / >0,88
// 60–69 <0,76 / 0,76–0,83 / 0,84–0,90 / >0,90
const TABLA_F: RangoCinturaCadera[] = [
  { decadaDesde: 20, decadaHasta: 29, bajoHasta: 0.71, moderadoDesde: 0.71, moderadoHasta: 0.77, altoDesde: 0.78, altoHasta: 0.82, muyAltoDesde: 0.82 },
  { decadaDesde: 30, decadaHasta: 39, bajoHasta: 0.72, moderadoDesde: 0.72, moderadoHasta: 0.78, altoDesde: 0.79, altoHasta: 0.84, muyAltoDesde: 0.84 },
  { decadaDesde: 40, decadaHasta: 49, bajoHasta: 0.73, moderadoDesde: 0.73, moderadoHasta: 0.79, altoDesde: 0.80, altoHasta: 0.87, muyAltoDesde: 0.87 },
  { decadaDesde: 50, decadaHasta: 59, bajoHasta: 0.74, moderadoDesde: 0.74, moderadoHasta: 0.81, altoDesde: 0.82, altoHasta: 0.88, muyAltoDesde: 0.88 },
  { decadaDesde: 60, decadaHasta: 69, bajoHasta: 0.76, moderadoDesde: 0.76, moderadoHasta: 0.83, altoDesde: 0.84, altoHasta: 0.90, muyAltoDesde: 0.90 },
]

// Hombres:
// 20–29 <0,83 / 0,83–0,88 / 0,89–0,94 / >0,94
// 30–39 <0,84 / 0,84–0,91 / 0,92–0,96 / >0,96
// 40–49 <0,88 / 0,88–0,95 / 0,96–1,00 / >1,00
// 50–59 <0,90 / 0,90–0,96 / 0,97–1,02 / >1,02
// 60–69 <0,91 / 0,91–0,98 / 0,99–1,03 / >1,03
const TABLA_M: RangoCinturaCadera[] = [
  { decadaDesde: 20, decadaHasta: 29, bajoHasta: 0.83, moderadoDesde: 0.83, moderadoHasta: 0.88, altoDesde: 0.89, altoHasta: 0.94, muyAltoDesde: 0.94 },
  { decadaDesde: 30, decadaHasta: 39, bajoHasta: 0.84, moderadoDesde: 0.84, moderadoHasta: 0.91, altoDesde: 0.92, altoHasta: 0.96, muyAltoDesde: 0.96 },
  { decadaDesde: 40, decadaHasta: 49, bajoHasta: 0.88, moderadoDesde: 0.88, moderadoHasta: 0.95, altoDesde: 0.96, altoHasta: 1.00, muyAltoDesde: 1.00 },
  { decadaDesde: 50, decadaHasta: 59, bajoHasta: 0.90, moderadoDesde: 0.90, moderadoHasta: 0.96, altoDesde: 0.97, altoHasta: 1.02, muyAltoDesde: 1.02 },
  { decadaDesde: 60, decadaHasta: 69, bajoHasta: 0.91, moderadoDesde: 0.91, moderadoHasta: 0.98, altoDesde: 0.99, altoHasta: 1.03, muyAltoDesde: 1.03 },
]

export const TABLA_CINTURA_CADERA: Record<Sexo, RangoCinturaCadera[]> = { F: TABLA_F, M: TABLA_M }

/** Corte OMS de respaldo (más simple, sin desglose por edad). */
export const CORTE_OMS_CINTURA_CADERA: Record<Sexo, number> = { F: 0.85, M: 0.9 }

export interface ResultadoCinturaCadera {
  categoria: CategoriaCinturaCadera
  decadaDesde: number
  decadaHasta: number
}

/** Clasifica cintura/cadera por sexo y edad (década 20–69). null fuera de rango. */
export function categoriaCinturaCadera(sexo: Sexo, edad: number, valor: number): ResultadoCinturaCadera | null {
  const decada = Math.floor(edad)
  if (decada < 20 || decada > 69) return null

  const rango = TABLA_CINTURA_CADERA[sexo].find((r) => decada >= r.decadaDesde && decada <= r.decadaHasta)
  if (!rango) return null

  const v = Math.round((valor + Number.EPSILON) * 100) / 100

  let categoria: CategoriaCinturaCadera
  if (v < rango.bajoHasta) categoria = 'bajo'
  else if (v <= rango.moderadoHasta) categoria = 'moderado'
  else if (v <= rango.altoHasta) categoria = 'alto'
  else categoria = 'muy_alto'

  return { categoria, decadaDesde: rango.decadaDesde, decadaHasta: rango.decadaHasta }
}
