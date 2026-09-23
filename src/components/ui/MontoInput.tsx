'use client'

import { useState } from 'react'

interface MontoInputProps {
  name: string
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

function formatPesos(raw: string): string {
  if (!raw) return ''
  const num = parseFloat(raw.replace(',', '.'))
  if (isNaN(num)) return raw
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export default function MontoInput({ name, value, onChange, placeholder, className, style }: MontoInputProps) {
  const [focused, setFocused] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Solo dígitos y coma (separador decimal argentino) — el punto se
    // descarta siempre como separador de miles, nunca se interpreta como
    // decimal (evita el truncamiento de "65.000" a 65). Se admite una sola
    // coma; cualquier coma adicional se descarta.
    let raw = e.target.value.replace(/[^\d,]/g, '')
    const primeraComa = raw.indexOf(',')
    if (primeraComa !== -1) {
      raw = raw.slice(0, primeraComa + 1) + raw.slice(primeraComa + 1).replace(/,/g, '')
    }
    onChange(raw.replace(',', '.'))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      name={name}
      value={focused ? value : formatPesos(value)}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder ?? 'Ej: 15000'}
      className={className}
      style={style}
    />
  )
}
