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
