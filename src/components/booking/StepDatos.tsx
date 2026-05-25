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

  const sym = profile.booking_moneda === 'USD' ? 'US$' : profile.booking_moneda === 'EUR' ? '€' : '$'

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
            <ResumenRow label="Modalidad" value={MODALIDAD_LABELS[modalidad] ?? modalidad} />
            <ResumenRow
              label="Fecha"
              value={<span style={{ textTransform: 'capitalize' }}>{fechaFmt} · {hora} hs</span>}
            />
            <ResumenRow label="Duración" value={`${duracion} min · ${TIPO_LABELS[tipo] ?? tipo}`} />
          </div>
          {precio !== null && (
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px solid #EFF4FF',
              display: 'flex', alignItems: 'baseline', gap: 4,
            }}>
              <span style={{ fontSize: 12, color: '#5B6472', fontWeight: 500 }}>Total</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: '#0B1220', marginLeft: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{sym}</span>
                {precio.toLocaleString('es-AR')}
              </span>
              <span style={{ fontSize: 12, color: '#8A93A1', fontWeight: 500 }}>{profile.booking_moneda}</span>
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
          Continuar al pago →
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
