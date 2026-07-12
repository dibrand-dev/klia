// Funciones puras de cálculo antropométrico — sin dependencias de React/Supabase.

// Normaliza altura a metros: si el valor es mayor a 3, se asume que vino en cm.
function alturaEnMetros(altura: number): number {
  return altura > 3 ? altura / 100 : altura
}

export function calcularIMC(peso: number | null | undefined, altura: number | null | undefined): number | null {
  if (!peso || !altura || peso <= 0 || altura <= 0) return null
  const alturaM = alturaEnMetros(altura)
  if (alturaM <= 0) return null
  return peso / (alturaM * alturaM)
}

export type IMCStatus = 'info' | 'success' | 'warning' | 'danger'

export function clasificarIMC(imc: number): { label: string; status: IMCStatus } {
  if (imc < 18.5) return { label: 'Bajo peso', status: 'info' }
  if (imc < 25) return { label: 'Normal', status: 'success' }
  if (imc < 30) return { label: 'Sobrepeso', status: 'warning' }
  return { label: 'Obesidad', status: 'danger' }
}

export type FormulaGEB = 'mifflin' | 'harris'

export function calcularGEB(
  peso: number | null | undefined,
  altura: number | null | undefined,
  edad: number | null | undefined,
  sexo: 'M' | 'F' | null | undefined,
  formula: FormulaGEB,
): number | null {
  if (!peso || !altura || edad == null || !sexo || peso <= 0 || altura <= 0 || edad <= 0) return null
  const alturaCm = altura > 3 ? altura : altura * 100

  if (formula === 'mifflin') {
    const base = 10 * peso + 6.25 * alturaCm - 5 * edad
    return sexo === 'M' ? base + 5 : base - 161
  }

  // Harris-Benedict (revisión 1984)
  return sexo === 'M'
    ? 88.362 + 13.397 * peso + 4.799 * alturaCm - 5.677 * edad
    : 447.593 + 9.247 * peso + 3.098 * alturaCm - 4.330 * edad
}

export interface MacrosPct {
  cho: number
  prot: number
  gra: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// Ajusta un macro y redistribuye los otros dos proporcionalmente a su ratio actual,
// manteniendo la suma siempre en 100. Parte siempre de `current` (el último estado
// consolidado), nunca acumula — así arrastrar el mismo slider muchas veces seguidas
// no genera drift de redondeo progresivo.
export function redistribuirMacros(current: MacrosPct, key: keyof MacrosPct, rawVal: number): MacrosPct {
  const keys: (keyof MacrosPct)[] = ['cho', 'prot', 'gra']
  const others = keys.filter((k) => k !== key)
  const [k1, k2] = others
  const newVal = clamp(Math.round(rawVal), 0, 100)
  const sumOthersOld = current[k1] + current[k2]
  const newSumOthers = 100 - newVal

  const next: MacrosPct = { ...current, [key]: newVal }
  if (sumOthersOld <= 0) {
    next[k1] = Math.round(newSumOthers / 2)
    next[k2] = newSumOthers - next[k1]
  } else {
    const ratio1 = current[k1] / sumOthersOld
    next[k1] = Math.round(ratio1 * newSumOthers)
    next[k2] = newSumOthers - next[k1]
  }

  // Corrección de redondeo — nunca mostrar error al usuario, se ajusta el segmento tocado
  const total = next.cho + next.prot + next.gra
  if (total !== 100) next[key] += (100 - total)

  return next
}

export function gramosDesdeMacro(kcalObjetivo: number | null, pct: number, kcalPorGramo: 4 | 9): number {
  if (!kcalObjetivo) return 0
  return Math.round((kcalObjetivo * pct) / 100 / kcalPorGramo)
}
