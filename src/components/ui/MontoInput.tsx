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

// DEUDA TÉCNICA CONOCIDA (2026-09-23): el campo solo acepta coma como
// separador decimal — el punto se descarta siempre como separador de miles,
// sin fallback. En un teclado numérico que no ofrezca coma (poco frecuente
// con inputMode="decimal" + locale es-AR, pero no garantizado en todos los
// dispositivos), no hay forma de ingresar un decimal. No se agrega un
// fallback de punto porque reabriría la ambigüedad del bug de hoy: un punto
// interpretado como decimal haría que "65.000" (que un profesional escribe
// queriendo decir sesenta y cinco mil) se guarde como 65. Una heurística por
// cantidad de dígitos después del punto (3 = miles, 1-2 = decimal) resolvería
// esto, pero se decidió no implementarla sin pensarla con más calma — agrega
// el mismo tipo de parseo silencioso con casos borde no obvios que causó el
// incidente original.
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
    // No convertir la coma a punto acá: el punto se sigue descartando
    // siempre como separador de miles en cada tecla (línea de arriba), así
    // que si emitiéramos "150." el punto que nosotros mismos pusimos se
    // borraría en la tecla siguiente ("150." + "5" = "150.5" → el `replace`
    // de arriba lo deja en "1505", perdiendo el decimal). parsearMontoInput
    // (src/lib/monedas.ts) hace la conversión coma→punto en el único punto
    // de salida (al guardar), no acá en cada tecla.
    onChange(raw)
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
