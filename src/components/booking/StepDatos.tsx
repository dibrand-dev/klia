'use client'

import type { ProfileData } from '@/app/p/[slug]/page'

interface FormData {
  nombre: string
  apellido: string
  email: string
  telefono: string
}

interface Props {
  profile: ProfileData
  tipo: string
  fecha: string
  hora: string
  modalidad: string
  form: FormData
  onForm: (f: FormData) => void
  onNext: () => void
  onBack: () => void
}

const TIPO_LABELS: Record<string, string> = {
  sesion: 'Sesión',
  entrevista: 'Entrevista inicial',
}

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  videollamada: 'Videollamada',
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

function formatPrice(price: number | null, moneda: string): string {
  if (price === null) return 'A confirmar'
  const sym = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  return `${sym} ${price.toLocaleString('es-AR')} ${moneda}`
}

function InputField({
  label,
  id,
  type,
  value,
  onChange,
  required,
  placeholder,
  prefix,
}: {
  label: string
  id: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  prefix?: string
}) {
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
          style={{
            flex: 1,
            padding: '11px 14px',
            border: '1.5px solid #E7E9EE',
            borderRadius: prefix ? '0 10px 10px 0' : 10,
            fontSize: 14,
            color: '#0B1220',
            background: '#fff',
            outline: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#2563EB' }}
          onBlur={(e) => { e.target.style.borderColor = '#E7E9EE' }}
        />
      </div>
    </div>
  )
}

export default function StepDatos({
  profile,
  tipo,
  fecha,
  hora,
  modalidad,
  form,
  onForm,
  onNext,
  onBack,
}: Props) {
  const duracion = tipo === 'sesion'
    ? profile.booking_duracion_sesion
    : profile.booking_duracion_entrevista

  const precio = tipo === 'sesion'
    ? profile.booking_precio_sesion
    : profile.booking_precio_entrevista

  const fechaFmt = formatFecha(fecha)
  const isValid = form.nombre.trim() && form.apellido.trim() && form.email.trim()

  function setField(k: keyof FormData, v: string) {
    onForm({ ...form, [k]: v })
  }

  return (
    <div>
      {/* Form card */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        border: '1px solid #E7E9EE',
        padding: '20px',
        marginBottom: 16,
        boxShadow: '0 1px 4px rgba(0,26,72,0.05)',
      }}>
        <p style={{
          margin: '0 0 18px',
          fontSize: 11,
          fontWeight: 700,
          color: '#8A93A1',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Tus datos
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div style={{ paddingRight: 8 }}>
            <InputField
              label="Nombre"
              id="bk-nombre"
              value={form.nombre}
              onChange={(v) => setField('nombre', v)}
              required
              placeholder="Ana"
            />
          </div>
          <div style={{ paddingLeft: 8 }}>
            <InputField
              label="Apellido"
              id="bk-apellido"
              value={form.apellido}
              onChange={(v) => setField('apellido', v)}
              required
              placeholder="García"
            />
          </div>
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
          label="Teléfono (opcional)"
          id="bk-telefono"
          type="tel"
          value={form.telefono}
          onChange={(v) => setField('telefono', v)}
          placeholder="11 1234-5678"
          prefix="+54"
        />
      </div>

      {/* Resumen — below form, no icons */}
      <div style={{
        background: '#EFF4FF',
        borderRadius: 16,
        border: '1px solid #BFDBFE',
        padding: '16px 18px',
        marginBottom: 16,
      }}>
        <p style={{
          margin: '0 0 12px',
          fontSize: 11,
          fontWeight: 700,
          color: '#1e40af',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Resumen de tu reserva
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ResumenRow label="Modalidad elegida" value={MODALIDAD_LABELS[modalidad] ?? modalidad} />
          <ResumenRow
            label="Fecha"
            value={<span style={{ textTransform: 'capitalize' }}>{fechaFmt} · {hora} hs</span>}
          />
          <ResumenRow label="Duración" value={`${duracion} min · ${TIPO_LABELS[tipo] ?? tipo}`} />
          {precio !== null && (
            <ResumenRow label="Precio" value={formatPrice(precio, profile.booking_moneda)} />
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            background: '#F6F7F9',
            color: '#374151',
            border: '1px solid #E7E9EE',
            borderRadius: 14,
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          ← Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          style={{
            flex: 2,
            background: isValid
              ? 'linear-gradient(135deg, #001a48, #002d72)'
              : '#E7E9EE',
            color: isValid ? '#fff' : '#AEB5C0',
            border: 'none',
            borderRadius: 14,
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 700,
            cursor: isValid ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: isValid ? '0 4px 14px rgba(0,26,72,0.25)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          Ir al pago →
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
