'use client'

import { useState } from 'react'

interface MontoInputProps {
  name: string
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  className?: string
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

export default function MontoInput({ name, value, onChange, placeholder, className }: MontoInputProps) {
  const [focused, setFocused] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Solo dígitos y separador decimal
    const raw = e.target.value.replace(/[^\d]/g, '')
    onChange(raw)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      name={name}
      value={focused ? value : formatPesos(value)}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder ?? 'Ej: 15000'}
      className={className}
    />
  )
}
