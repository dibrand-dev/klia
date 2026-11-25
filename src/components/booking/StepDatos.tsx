'use client'

import { useState } from 'react'
import type { ProfileData, SedePublica } from '@/app/p/[slug]/page'
import { validarDniReserva, validarFechaNacimientoReserva } from '@/lib/booking/validar-datos-reserva'

interface FormData {
  nombre: string
  apellido: string
  email: string
  telefono: string
  dni: string
  fechaNacimiento: string
  coberturaId: string
  whatsappOptIn: boolean
}

type TipoResuelto = {
  duracion: number
  precio: number | null
  moneda: string
  nombre: string
}

interface Props {
  profile: ProfileData
  tipoResuelto: TipoResuelto
  fecha: string
  hora: string
  modalidad: string
  form: FormData
  onForm: (f: FormData) => void
  onNext: () => void
  onBack: () => void
  sede?: SedePublica | null
  requiereDni?: boolean
  requiereFechaNacimiento?: boolean
}

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  videollamada: 'Online',
  telefonica: 'Telefónica',
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function InputField({
  label,
  id,
  type,
  value,
  onChange,
  onBlur,
  required,
  placeholder,
  prefix,
  inputMode,
  min,
  max,
  error,
}: {
  label: string
  id: string
  type?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  required?: boolean
  placeholder?: string
  prefix?: string
  inputMode?: 'text' | 'numeric' | 'tel'
  min?: string
  max?: string
  error?: string
}) {
  const [focused, setFocused] = useState(false)
  const errorId = `${id}-error`
  const borderColor = focused ? '#2563EB' : (error ? 'var(--danger)' : '#E7E9EE')

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: '#374151',
          marginBottom: 6,
          letterSpacing: '0.01em',
        }}
      >
        {label}
        {required && <span style={{ color: '#2563EB', marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: 'relative', display: 'flex' }}>
        {prefix && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            background: '#F6F7F9',
            border: '1.5px solid #E7E9EE',
            borderRight: 'none',
            borderRadius: '10px 0 0 10px',
            fontSize: 13,
            color: '#8A93A1',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}>
            {prefix}
          </div>
        )}
        <input
          id={id}
          type={type ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          inputMode={inputMode}
          min={min}
          max={max}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          style={{
            flex: 1,
            padding: '11px 14px',
            border: `1.5px solid ${borderColor}`,
            borderRadius: prefix ? '0 10px 10px 0' : 10,
            fontSize: 14,
            color: '#0B1220',
            background: '#fff',
            outline: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'border-color 0.15s',
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.() }}
        />
      </div>
      {error && (
        <p id={errorId} style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--danger)' }}>{error}</p>
      )}
    </div>
  )
}

export default function StepDatos({
  profile,
  tipoResuelto,
  fecha,
  hora,
  modalidad,
  form,
  onForm,
  onNext,
  onBack,
  sede,
  requiereDni,
  requiereFechaNacimiento,
}: Props) {
  const duracion = tipoResuelto.duracion
  const precio = tipoResuelto.precio

  const fechaFmt = formatFecha(fecha)

  const [dniTouched, setDniTouched] = useState(false)
  const [fechaNacTouched, setFechaNacTouched] = useState(false)

  // Contenido inválido bloquea isValid aunque el campo sea opcional —
  // independiente de si ya fue "tocado" (eso solo controla si se MUESTRA
  // el mensaje de error, no si el dato es aceptable para continuar).
  const dniInvalido = form.dni.trim() !== '' && !validarDniReserva(form.dni)
  const fechaNacInvalida = form.fechaNacimiento.trim() !== '' && !validarFechaNacimientoReserva(form.fechaNacimiento)

  const dniError = dniTouched && dniInvalido ? 'Ingresá un DNI válido (6 a 9 números).' : undefined
  const fechaNacError = fechaNacTouched && fechaNacInvalida ? 'Ingresá una fecha de nacimiento válida.' : undefined

  const isValid = Boolean(
    form.nombre.trim() && form.apellido.trim() && form.email.trim() && form.coberturaId !== ''
    && (!requiereDni || form.dni.trim())
    && (!requiereFechaNacimiento || form.fechaNacimiento.trim())
    && !dniInvalido
    && !fechaNacInvalida
  )

  function setField(k: keyof FormData, v: string) {
    onForm({ ...form, [k]: v })
  }

  const sym = tipoResuelto.moneda === 'USD' ? 'US$' : tipoResuelto.moneda === 'EUR' ? '€' : '$'

  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0B1220', letterSpacing: '-0.015em' }}>
        Tus datos
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5B6472' }}>
        Completá los siguientes datos para confirmar tu turno.
      </p>

      {/* Form card with summary inside */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #E7E9EE',
        padding: '22px',
        marginBottom: 18,
        boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
      }}>
        <div className="bk-nombre-apellido-grid">
          <div className="bk-nombre-apellido-col">
            <InputField
              label="Nombre"
              id="bk-nombre"
              value={form.nombre}
              onChange={(v) => setField('nombre', v)}
              required
              placeholder="Ana"
            />
          </div>
          <div className="bk-nombre-apellido-col">
            <InputField
              label="Apellido"
              id="bk-apellido"
              value={form.apellido}
              onChange={(v) => setField('apellido', v)}
              required
              placeholder="García"
            />
          </div>
          <style jsx>{`
            .bk-nombre-apellido-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 0;
            }
            .bk-nombre-apellido-col:first-child {
              padding-right: 8px;
            }
            .bk-nombre-apellido-col:last-child {
              padding-left: 8px;
            }
            @media (max-width: 460px) {
              .bk-nombre-apellido-grid {
                grid-template-columns: 1fr;
                gap: 8px;
              }
              .bk-nombre-apellido-col:first-child,
              .bk-nombre-apellido-col:last-child {
                padding-right: 0;
                padding-left: 0;
              }
            }
          `}</style>
        </div>

        <InputField
          label="Email"
          id="bk-email"
          type="email"
          value={form.email}
          onChange={(v) => setField('email', v)}
          required
          placeholder="ana@ejemplo.com"
        />

        <InputField
          label={`DNI${requiereDni ? '' : ' (opcional)'}`}
          id="bk-dni"
          inputMode="numeric"
          value={form.dni}
          onChange={(v) => setField('dni', v)}
          onBlur={() => setDniTouched(true)}
          required={requiereDni}
          placeholder="12345678"
          error={dniError}
        />

        <InputField
          label={`Fecha de nacimiento${requiereFechaNacimiento ? '' : ' (opcional)'}`}
          id="bk-fecha-nacimiento"
          type="date"
          value={form.fechaNacimiento}
          onChange={(v) => setField('fechaNacimiento', v)}
          onBlur={() => setFechaNacTouched(true)}
          required={requiereFechaNacimiento}
          min="1900-01-01"
          max={new Date().toISOString().slice(0, 10)}
          error={fechaNacError}
        />

        <InputField
          label="Teléfono (opcional)"
          id="bk-telefono"
          type="tel"
          value={form.telefono}
          onChange={(v) => setField('telefono', v)}
          placeholder="11 1234-5678"
          prefix="+54"
        />

        <p style={{ margin: '-6px 0 16px', fontSize: 11.5, color: '#8A93A1', lineHeight: 1.5 }}>
          Usamos estos datos para tu ficha clínica. Más info en nuestra{' '}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#8A93A1', textDecoration: 'underline' }}>
            Política de Privacidad
          </a>.
        </p>

        <label
          htmlFor="bk-whatsapp-opt-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            fontSize: 13,
            color: '#5B6472',
            cursor: 'pointer',
          }}
        >
          <input
            id="bk-whatsapp-opt-in"
            type="checkbox"
            checked={form.whatsappOptIn}
            onChange={(e) => onForm({ ...form, whatsappOptIn: e.target.checked })}
            style={{ width: 16, height: 16, flexShrink: 0 }}
          />
          Quiero recibir recordatorios por WhatsApp
        </label>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 6,
              letterSpacing: '0.01em',
            }}
          >
            ¿Cómo vas a abonar?
            <span style={{ color: '#2563EB', marginLeft: 2 }}>*</span>
          </label>
          <select
            value={form.coberturaId}
            onChange={(e) => setField('coberturaId', e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              border: '1.5px solid #E7E9EE',
              borderRadius: 10,
              fontSize: 14,
              color: '#0B1220',
              background: '#fff',
              outline: 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <option value="" disabled>Seleccioná una opción</option>
            <option value="particular">Particular</option>
            {profile.obrasSociales.map((os) => (
              <option key={os.id} value={os.id}>{os.nombre}</option>
            ))}
          </select>
        </div>

        {/* Summary inside form-card */}
        <div style={{
          background: 'linear-gradient(135deg, #F4F7FF, #fff)',
          border: '1px solid #EFF4FF',
          borderRadius: 12,
          padding: '16px 18px',
          marginTop: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: '#1e40af',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Resumen de tu reserva
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sede && <ResumenRow label="Sede" value={sede.nombre} />}
            <ResumenRow label="Modalidad" value={MODALIDAD_LABELS[modalidad] ?? modalidad} />
            <ResumenRow
              label="Fecha"
              value={<span style={{ textTransform: 'capitalize' }}>{fechaFmt} · {hora} hs</span>}
            />
            <ResumenRow label="Duración" value={`${duracion} min · ${tipoResuelto.nombre}`} />
          </div>
          {precio !== null && (
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px solid #EFF4FF',
              display: 'flex', alignItems: 'baseline', gap: 4,
            }}>
              {form.coberturaId === '' || form.coberturaId === 'particular' ? (
                <>
                  <span style={{ fontSize: 12, color: '#5B6472', fontWeight: 500 }}>Total</span>
                  <span style={{ fontSize: 19, fontWeight: 700, color: '#0B1220', marginLeft: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{sym}</span>
                    {precio.toLocaleString('es-AR')}
                  </span>
                  <span style={{ fontSize: 12, color: '#8A93A1', fontWeight: 500 }}>{tipoResuelto.moneda}</span>
                </>
              ) : (
                <span style={{ fontSize: 12.5, color: '#5B6472', fontWeight: 500 }}>Este costo lo cubre tu obra social</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={onNext}
          disabled={!isValid}
          style={{
            width: '100%',
            background: isValid
              ? 'linear-gradient(135deg, #001a48, #002d72)'
              : '#E7E9EE',
            color: isValid ? '#fff' : '#AEB5C0',
            border: 'none',
            borderRadius: 10,
            padding: '13px 18px',
            fontSize: 14.5,
            fontWeight: 600,
            cursor: isValid ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: isValid ? '0 6px 18px rgba(0,45,114,0.25)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {form.coberturaId === '' || form.coberturaId === 'particular' ? 'Continuar al pago →' : 'Continuar →'}
        </button>
        <button
          onClick={onBack}
          style={{
            width: '100%',
            background: 'transparent',
            color: '#5B6472',
            border: 'none',
            borderRadius: 10,
            padding: '11px 12px',
            fontSize: 13.5,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Volver
        </button>
      </div>
    </div>
  )
}

function ResumenRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 4, fontSize: 13, color: '#1F2937', lineHeight: 1.5 }}>
      <span style={{ color: '#5B6472', flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}
