// Helpers de presentación para los informes (profesional y del paciente). No son
// fórmulas ISAK — son utilidades puras de comparación/formato reusadas por las páginas.

/** Compara dos valores a 1 decimal (redondeo half-up). true si son iguales a esa precisión. */
export function compararIgual(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false
  const r = (v: number) => Math.round((v + Number.EPSILON) * 10) / 10
  return r(a) === r(b)
}

/**
 * Valida una URL de red social para un link público: solo http(s). Si viene sin
 * protocolo, antepone https://. Descarta javascript:/data:/mailto:/etc. y
 * cualquier string vacío o inválido. Devuelve null si no es una URL http(s) válida.
 */
export function urlSocialSegura(u: string | null | undefined): string | null {
  if (!u) return null
  const valor = u.trim()
  if (!valor) return null
  const conProtocolo = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(valor) ? valor : `https://${valor}`
  let url: URL
  try {
    url = new URL(conProtocolo)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.toString()
}

/** Etiqueta de presentación de una categoría de la tabla cintura/cadera ('muy_alto' → 'Muy alto'). */
const ETIQUETAS_CATEGORIA_CINTURA_CADERA: Record<string, string> = {
  bajo: 'Bajo', moderado: 'Moderado', alto: 'Alto', muy_alto: 'Muy alto',
}

export function etiquetaCategoriaCinturaCadera(categoria: string): string {
  return ETIQUETAS_CATEGORIA_CINTURA_CADERA[categoria] ?? categoria
}

export interface PorcentajesTejidos { adiposo: number; muscular: number; oseo: number }

/**
 * % de cada tejido sobre la suma de los tres (adiposo+muscular+óseo) — mismo criterio
 * que la torta de distribución (ya normalizada sobre esa suma, nunca sobre la masa
 * corporal). `null` si falta algún tejido o la suma es 0. Redondea a `dec` decimales
 * (default 1, igual que el resto del informe) y corrige el mayor de los tres para que
 * la suma de los redondeados sea siempre exactamente 100 (nunca 99 ni 101 por arrastre
 * de redondeo).
 */
export function porcentajesTejidos(
  tejidos: { adiposo: number | null; muscular: number | null; oseo: number | null },
  dec = 1,
): PorcentajesTejidos | null {
  const { adiposo, muscular, oseo } = tejidos
  if (adiposo === null || muscular === null || oseo === null) return null
  const suma = adiposo + muscular + oseo
  if (suma <= 0) return null

  const factor = 10 ** dec
  const crudo = {
    adiposo: (adiposo / suma) * 100,
    muscular: (muscular / suma) * 100,
    oseo: (oseo / suma) * 100,
  }
  const redondeado = {
    adiposo: Math.round((crudo.adiposo + Number.EPSILON) * factor) / factor,
    muscular: Math.round((crudo.muscular + Number.EPSILON) * factor) / factor,
    oseo: Math.round((crudo.oseo + Number.EPSILON) * factor) / factor,
  }
  const total = Math.round((redondeado.adiposo + redondeado.muscular + redondeado.oseo) * factor) / factor
  const diferencia = Math.round((100 - total) * factor) / factor
  if (diferencia === 0) return redondeado

  const mayor = (['adiposo', 'muscular', 'oseo'] as const).reduce((m, k) => (crudo[k] > crudo[m] ? k : m), 'adiposo' as const)
  redondeado[mayor] = Math.round((redondeado[mayor] + diferencia) * factor) / factor
  return redondeado
}
