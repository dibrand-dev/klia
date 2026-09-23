export const MONEDAS = ['ARS', 'USD', 'EUR'] as const
export type Moneda = typeof MONEDAS[number]

export const MONEDA_SIMBOLO: Record<Moneda, string> = {
  ARS: '$',
  USD: 'U$S',
  EUR: '€',
}

export const MONEDA_LABEL: Record<Moneda, string> = {
  ARS: 'Pesos argentinos (ARS)',
  USD: 'Dólares (USD)',
  EUR: 'Euros (EUR)',
}

// El raw que emite MontoInput (src/components/ui/MontoInput.tsx) usa coma
// como separador decimal (nunca punto, reservado como separador de miles a
// descartar) — todo consumidor que convierte ese raw a number debe pasar por
// acá en vez de Number()/parseFloat() directo, o pierde el decimal.
export function parsearMontoInput(raw: string): number | null {
  if (!raw) return null
  const n = parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Inversa de parsearMontoInput: para precargar un MontoInput con un valor
// que viene de la base (String(numero) usa punto, ej. "150.5") hay que
// pasarlo primero por acá — si no, la primera tecla que edite ese campo
// rompe el decimal (el punto se descarta siempre como separador de miles).
export function formatearMontoInputInicial(monto: number | null | undefined): string {
  if (monto == null) return ''
  return String(monto).replace('.', ',')
}

export function formatearMonto(monto: number, moneda: Moneda): string {
  const simbolo = MONEDA_SIMBOLO[moneda]
  const [intPart, decPart = '00'] = monto.toFixed(2).split('.')
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${simbolo} ${formattedInt},${decPart}`
}

export function agruparPorMoneda(
  items: Array<{ monto: number | null; moneda: string }>
): Partial<Record<Moneda, number>> {
  return items.reduce((acc, item) => {
    if (!item.monto) return acc
    const moneda = (item.moneda || 'ARS') as Moneda
    acc[moneda] = (acc[moneda] || 0) + item.monto
    return acc
  }, {} as Partial<Record<Moneda, number>>)
}
