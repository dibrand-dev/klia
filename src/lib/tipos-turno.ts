import { getTerminologia } from '@/hooks/useTerminologia'

// Lógica pura de validación de "tipos de turno" — sin dependencias de
// Supabase ni de Next — reusada entre POST y PATCH de /api/tipos-turno.

export const MONEDAS_VALIDAS = ['ARS', 'USD', 'EUR'] as const
export type MonedaTipoTurno = typeof MONEDAS_VALIDAS[number]

const RESERVADOS = ['sesion', 'consulta', 'entrevista']

// Sin tildes, minúsculas, sin espacios en los bordes — para comparar "Sesión"
// contra "sesion" o "SESIÓN" como el mismo nombre reservado.
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Colapsa espacios internos repetidos y recorta los de los bordes — "sin
// espacios sobrantes" tal como lo pidió el profesional, no solo trim().
export function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ')
}

export function nombreEsReservado(nombre: string, terminologia: 'sesion' | 'consulta' | null | undefined): boolean {
  const n = normalizar(nombre)
  if (RESERVADOS.includes(n)) return true
  const palabraTerminologia = getTerminologia(terminologia).Sesion // "Sesión" o "Consulta" según config del profesional
  return n === normalizar(palabraTerminologia)
}

export interface ValidacionError {
  error: string
}

export interface TipoTurnoInputValidado {
  nombre: string
  descripcion: string | null
  duracion_min: number
  precio: number | null
  moneda: MonedaTipoTurno
}

// Valida los campos editables de un tipo de turno. `terminologia` es la del
// profesional dueño (nunca la del usuario logueado si es Colaboradora).
export function validarTipoTurnoInput(
  body: { nombre?: unknown; descripcion?: unknown; duracion_min?: unknown; precio?: unknown; moneda?: unknown },
  terminologia: 'sesion' | 'consulta' | null | undefined,
): ValidacionError | TipoTurnoInputValidado {
  if (typeof body.nombre !== 'string') {
    return { error: 'El nombre es obligatorio' }
  }
  const nombre = limpiarNombre(body.nombre)
  if (nombre.length < 1 || nombre.length > 80) {
    return { error: 'El nombre debe tener entre 1 y 80 caracteres' }
  }
  if (nombreEsReservado(nombre, terminologia)) {
    return { error: `"${nombre}" es un nombre reservado del sistema — elegí otro` }
  }

  if (typeof body.duracion_min !== 'number' || !Number.isInteger(body.duracion_min)) {
    return { error: 'La duración debe ser un número entero de minutos' }
  }
  if (body.duracion_min < 5 || body.duracion_min > 480) {
    return { error: 'La duración debe estar entre 5 y 480 minutos' }
  }

  let precio: number | null = null
  if (body.precio !== null && body.precio !== undefined) {
    if (typeof body.precio !== 'number' || Number.isNaN(body.precio)) {
      return { error: 'El precio debe ser un número' }
    }
    if (body.precio < 0) {
      return { error: 'El precio no puede ser negativo' }
    }
    precio = body.precio
  }

  const moneda = typeof body.moneda === 'string' ? body.moneda : 'ARS'
  if (!MONEDAS_VALIDAS.includes(moneda as MonedaTipoTurno)) {
    return { error: `Moneda inválida — tiene que ser ${MONEDAS_VALIDAS.join(', ')}` }
  }

  let descripcion: string | null = null
  if (body.descripcion !== null && body.descripcion !== undefined) {
    if (typeof body.descripcion !== 'string') {
      return { error: 'La descripción debe ser texto' }
    }
    const descripcionTrim = body.descripcion.trim()
    if (descripcionTrim.length > 500) {
      return { error: 'La descripción no puede superar los 500 caracteres' }
    }
    descripcion = descripcionTrim.length > 0 ? descripcionTrim : null
  }

  return { nombre, descripcion, duracion_min: body.duracion_min, precio, moneda: moneda as MonedaTipoTurno }
}
