import { normalizarDni } from '@/lib/pacientes/duplicados'

export function validarDniReserva(input: string): string | null {
  const limpio = normalizarDni(input)
  if (!limpio) return null
  if (limpio.length < 6 || limpio.length > 9) return null
  return limpio
}

export function validarFechaNacimientoReserva(input: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!m) return null
  const [, yStr, moStr, dStr] = m
  const y = Number(yStr)
  const mo = Number(moStr)
  const d = Number(dStr)
  if (y < 1900) return null

  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null

  const hoy = new Date()
  const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  if (date.getTime() > hoyUTC.getTime()) return null

  return input.trim()
}
