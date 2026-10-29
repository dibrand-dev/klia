// Helpers puros para las tarjetas de cálculo en vivo de la nota por
// especialidad — puerto directo de las funciones n/f1/f0/dl del diseño de
// referencia, sin dependencias de React/Supabase.

export function n(v: string | undefined | null): number | null {
  if (v == null || v === '') return null
  const parsed = Number(String(v).replace(',', '.'))
  return isNaN(parsed) ? null : parsed
}

export function f1(x: number): string {
  return x.toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
}

export function f0(x: number): string {
  return Math.round(x).toLocaleString('es-AR')
}

// Diferencia vs. un valor anterior, con flecha de color (sube=verde salvo que
// `inv` invierta el sentido "bueno" — ej. dolor o TA, donde bajar es mejor).
export function dl(a: number, b: number, u: string, inv?: boolean): string {
  const d = a - b
  if (Math.abs(d) < 0.05) return `<span class="dz">Sin cambios</span>`
  const good = inv ? d < 0 : d > 0
  return `<span class="${good ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${f1(Math.abs(d))} ${u}</span>`
}

export interface ResultadoCalc {
  val?: string
  sub?: string
  hint?: string
  warn?: boolean
}

export function hint(texto: string): ResultadoCalc {
  return { hint: texto }
}
