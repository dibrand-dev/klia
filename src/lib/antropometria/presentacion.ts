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
