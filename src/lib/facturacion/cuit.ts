// CUIT (Argentina) — validación y formato. Librería pura: sin dependencias, sin I/O.

const PREFIJOS_VALIDOS = ['20', '23', '24', '27', '30', '33', '34']
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/** Deja solo dígitos (saca guiones, puntos, espacios, etc.). */
export function normalizarCuit(input: string): string {
  return input.replace(/\D/g, '')
}

/** 11 dígitos, prefijo válido y dígito verificador módulo 11 correcto. */
export function validarCuit(input: string): boolean {
  const digitos = normalizarCuit(input)
  if (digitos.length !== 11) return false
  if (!PREFIJOS_VALIDOS.includes(digitos.slice(0, 2))) return false

  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(digitos[i]), 0)
  const resto = suma % 11
  const dv = resto === 0 ? 0 : 11 - resto
  if (dv === 10) return false

  return dv === Number(digitos[10])
}

/** "XX-XXXXXXXX-X" si tiene 11 dígitos; si no, devuelve el string de dígitos tal cual. */
export function formatearCuit(digitos: string): string {
  const d = normalizarCuit(digitos)
  if (d.length !== 11) return d
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}
