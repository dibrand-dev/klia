// Evolución de una medición antropométrica vs. la anterior, para mostrar junto a la
// nota clínica en el Historial. Librería pura: sin dependencias, sin I/O.

import { compararIgual } from './presentacion'

export type DireccionEvolucion = 'aumento' | 'disminuyo' | 'se_mantuvo'

export interface CampoEvolucionSesion {
  valor: number
  diferencia: number | null
  direccion: DireccionEvolucion | null
}

export interface MedicionBasica {
  peso: number | null
  s6: number | null
  s8: number | null
}

export interface ResumenEvolucionSesion {
  peso?: CampoEvolucionSesion
  s6?: CampoEvolucionSesion
  s8?: CampoEvolucionSesion
}

const CAMPOS: (keyof MedicionBasica)[] = ['peso', 's6', 's8']

/**
 * Para peso, Σ6 y Σ8: valor actual, diferencia con signo y dirección vs. la medición
 * anterior. Un campo se omite si falta el valor actual (nunca se inventa). Si el valor
 * actual existe pero no hay anterior (o el anterior no tiene ese campo), queda con
 * diferencia/dirección en null (caso "primera medición", por campo). "se_mantuvo" usa
 * compararIgual() (redondeo a 1 decimal), no el valor crudo. null si no queda ningún campo.
 */
export function resumenEvolucionSesion(actual: MedicionBasica, previo: MedicionBasica | null): ResumenEvolucionSesion | null {
  const resultado: ResumenEvolucionSesion = {}
  for (const campo of CAMPOS) {
    const v = actual[campo]
    if (v == null) continue
    const pv = previo?.[campo] ?? null
    if (pv == null) {
      resultado[campo] = { valor: v, diferencia: null, direccion: null }
    } else {
      const direccion: DireccionEvolucion = compararIgual(v, pv) ? 'se_mantuvo' : v > pv ? 'aumento' : 'disminuyo'
      resultado[campo] = { valor: v, diferencia: v - pv, direccion }
    }
  }
  return Object.keys(resultado).length > 0 ? resultado : null
}

export interface RegistroConTurno { turno_id: string | null; fecha: string; created_at: string }

/**
 * El registro más reciente (por fecha, y created_at a igualdad de fecha) para cada
 * turno_id. Un registro sin turno_id nunca entra — una medición sin turno no se asocia
 * a ninguna sesión del Historial.
 */
export function registroMasRecientePorTurno<T extends RegistroConTurno>(registros: T[]): Map<string, T> {
  const ordenados = [...registros].sort((a, b) => (a.fecha + a.created_at).localeCompare(b.fecha + b.created_at))
  const porTurno = new Map<string, T>()
  for (const r of ordenados) {
    if (r.turno_id) porTurno.set(r.turno_id, r)
  }
  return porTurno
}

/**
 * turno_id de los turnos que tienen una medición asociada pero ninguna nota propia —
 * las entradas "solo medición" del Historial. No depende del estado del turno: uno
 * cancelado con medición sigue devolviéndose igual (la UI decide cómo mostrarlo).
 */
export function turnoIdsSoloMedicion(turnoIdsConNota: Set<string>, porTurno: Map<string, unknown>): string[] {
  return Array.from(porTurno.keys()).filter((id) => !turnoIdsConNota.has(id))
}
