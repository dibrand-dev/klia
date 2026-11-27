'use client'

import { useEffect, useState } from 'react'
import { displayAIso, formatearMientrasEscribe, isoADisplay } from '@/lib/fecha-nacimiento'

interface FechaNacimientoInputProps {
  // Contrato igual que un <input type="date">: el value que entra/sale es
  // siempre ISO yyyy-mm-dd, o '' si está vacío/incompleto/inválido. No
  // cambia lo que cada caller guarda en Supabase.
  value: string
  onChange: (iso: string) => void
  id?: string
  name?: string
  required?: boolean
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  onBlur?: () => void
  onFocus?: () => void
  ariaInvalid?: boolean
  ariaDescribedBy?: string
  // false cuando el caller ya muestra su propio mensaje de error debajo
  // (ej. StepDatos.tsx en la reserva pública, que valida con
  // validarFechaNacimientoReserva y tiene su propio <p> de error).
  mostrarError?: boolean
}

export default function FechaNacimientoInput({
  value,
  onChange,
  id,
  name,
  required,
  placeholder = 'DD/MM/AAAA',
  className,
  style,
  onBlur,
  onFocus,
  ariaInvalid,
  ariaDescribedBy,
  mostrarError = true,
}: FechaNacimientoInputProps) {
  const [texto, setTexto] = useState(() => isoADisplay(value))
  const [tocado, setTocado] = useState(false)

  const digitosActuales = texto.replace(/\D/g, '')
  const isoDelTextoActual = digitosActuales.length === 8 ? displayAIso(texto) : null

  // Si el value externo cambia por algo que no fue nuestro propio onChange
  // (ej. el formulario carga otro paciente, o se resetea después de
  // guardar), resincroniza el texto mostrado. Mientras el usuario tipea una
  // fecha incompleta o inválida, el onChange hacia afuera manda '' — por eso
  // comparamos contra lo que el texto actual ya produciría, para no pisarle
  // lo que está escribiendo a mitad de tipear.
  useEffect(() => {
    if (value !== (isoDelTextoActual ?? '')) {
      setTexto(value ? isoADisplay(value) : '')
      setTocado(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const invalida = tocado && digitosActuales.length > 0 && !isoDelTextoActual

  function manejarCambio(e: React.ChangeEvent<HTMLInputElement>) {
    const formateado = formatearMientrasEscribe(e.target.value)
    setTexto(formateado)
    const digitos = formateado.replace(/\D/g, '')
    const iso = digitos.length === 8 ? displayAIso(formateado) : null
    onChange(iso ?? '')
  }

  return (
    <>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        value={texto}
        onChange={manejarCambio}
        onFocus={onFocus}
        onBlur={() => { setTocado(true); onBlur?.() }}
        required={required}
        placeholder={placeholder}
        className={className}
        style={style}
        maxLength={10}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
      {mostrarError && invalida && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--danger)' }}>
          Ingresá una fecha válida, ej. 15/03/1985.
        </p>
      )}
    </>
  )
}
