'use client'

import { MONEDAS, MONEDA_SIMBOLO, type Moneda } from '@/lib/monedas'

const MONEDA_SHORT: Record<Moneda, string> = {
  ARS: 'ARS — Pesos',
  USD: 'USD — Dólares',
  EUR: 'EUR — Euros',
}

interface MonedaSelectorProps {
  value: Moneda
  onChange: (moneda: Moneda) => void
  className?: string
}

export default function MonedaSelector({ value, onChange, className = '' }: MonedaSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Moneda)}
      className={`bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors ${className}`}
    >
      {MONEDAS.map((m) => (
        <option key={m} value={m}>
          {MONEDA_SIMBOLO[m]} {MONEDA_SHORT[m]}
        </option>
      ))}
    </select>
  )
}
