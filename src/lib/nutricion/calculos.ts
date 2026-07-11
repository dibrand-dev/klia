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
