'use client'

import Image from 'next/image'
import type { ProfileData } from '@/app/p/[slug]/page'

interface Props {
  profile: ProfileData
  tipo: 'sesion' | 'entrevista'
  modalidad: string
  onTipo: (t: 'sesion' | 'entrevista') => void
  onModalidad: (m: string) => void
  onNext: () => void
}

const MODALIDAD_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  videollamada: 'Videollamada',
  telefonica: 'Telefónica',
}

function formatPrice(price: number, moneda: string): string {
  const sym = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$'
  return `${sym}${price.toLocaleString('es-AR')}`
}

function Initials({ nombre, apellido }: { nombre: string; apellido: string }) {
  const initials = `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
  return (
    <div style={{
      width: 72, height: 72, borderRadius: 36,
      background: 'linear-gradient(135deg, #001a48, #002d72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 26, fontWeight: 700, color: '#fff',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function StepTipoConsulta({
  profile,
  tipo,
  modalidad,
  onTipo,
  onModalidad,
  onNext,
}: Props) {
  const hasSesion = profile.booking_precio_sesion !== null && profile.booking_precio_sesion !== undefined
  const hasEntrevista = profile.booking_precio_entrevista !== null && profile.booking_precio_entrevista !== undefined
  const showBoth = !hasSesion && !hasEntrevista

  const tipoOptions: Array<{ key: 'sesion' | 'entrevista'; label: string; desc: string; price: number | null; dur: number }> = []

  if (hasSesion || showBoth) {
    tipoOptions.push({
      key: 'sesion',
      label: 'Sesión',
      desc: 'Sesión terapéutica individual',
      price: profile.booking_precio_sesion,
      dur: profile.booking_duracion_sesion,
    })
  }
  if (hasEntrevista || showBoth) {
    tipoOptions.push({
      key: 'entrevista',
      label: 'Entrevista inicial',
      desc: 'Primera consulta de evaluación',
      price: profile.booking_precio_entrevista,
      dur: profile.booking_duracion_entrevista,
    })
  }

  const showModalidadToggle = profile.booking_modalidades.length > 1

  return (
    <div>
      {/* Pro card */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        border: '1px solid #E7E9EE',
        padding: '24px 20px',
        marginBottom: 16,
        boxShadow: '0 1px 4px rgba(0,26,72,0.05)',
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0 }}>
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={`${profile.nombre} ${profile.apellido}`}
                width={72}
                height={72}
                style={{ width: 72, height: 72, borderRadius: 36, objectFit: 'cover' }}
              />
            ) : (
              <Initials nombre={profile.nombre} apellido={profile.apellido} />
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin: '0 0 4px',
              fontSize: 20,
              fontWeight: 700,
              color: '#0B1220',
              letterSpacing: '-0.3px',
            }}>
              {profile.nombre} {profile.apellido}
            </h1>
            {profile.especialidad && (
              <p style={{ margin: '0 0 4px', fontSize: 14, color: '#5B6472', fontWeight: 500 }}>
                {profile.especialidad}
              </p>
            )}
            {profile.matricula && (
              <span style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 600,
                color: '#8A93A1',
                background: '#F1F3F6',
                borderRadius: 6,
                padding: '2px 8px',
                letterSpacing: '0.02em',
              }}>
                Mat. {profile.matricula}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex',
          gap: 20,
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid #F1F3F6',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#001a48' }}>120+</div>
            <div style={{ fontSize: 11, color: '#8A93A1', marginTop: 2 }}>Pacientes</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#001a48' }}>4.9</div>
            <div style={{ fontSize: 11, color: '#8A93A1', marginTop: 2 }}>Valoración</div>
          </div>
          {profile.booking_modalidades.length > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#001a48' }}>
                {profile.booking_modalidades.length}
              </div>
              <div style={{ fontSize: 11, color: '#8A93A1', marginTop: 2 }}>Modalidades</div>
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.booking_bio && (
          <p style={{
            margin: '16px 0 0',
            fontSize: 14,
            color: '#374151',
            lineHeight: 1.65,
          }}>
            {profile.booking_bio}
          </p>
        )}
      </div>

      {/* Session type */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        border: '1px solid #E7E9EE',
        padding: '20px',
        marginBottom: 16,
        boxShadow: '0 1px 4px rgba(0,26,72,0.05)',
      }}>
        <p style={{
          margin: '0 0 14px',
          fontSize: 11,
          fontWeight: 700,
          color: '#8A93A1',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Tipo de consulta
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: tipoOptions.length === 1 ? '1fr' : '1fr 1fr',
          gap: 10,
        }}>
          {tipoOptions.map((opt) => {
            const selected = tipo === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => onTipo(opt.key)}
                style={{
                  background: selected ? '#EFF4FF' : '#F6F7F9',
                  border: selected ? '2px solid #2563EB' : '2px solid transparent',
                  borderRadius: 14,
                  padding: '16px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: selected ? '#1e40af' : '#0B1220',
                  marginBottom: 4,
                }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: '#5B6472', marginBottom: 8 }}>
                  {opt.desc}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {opt.price !== null ? (
                    <span style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: selected ? '#1e40af' : '#0B1220',
                    }}>
                      {formatPrice(opt.price, profile.booking_moneda)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 14, color: '#8A93A1' }}>A confirmar</span>
                  )}
                  <span style={{
                    fontSize: 11,
                    color: '#8A93A1',
                    background: '#fff',
                    borderRadius: 20,
                    padding: '2px 8px',
                    fontWeight: 500,
                  }}>
                    {opt.dur} min
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modality toggle */}
      {showModalidadToggle && (
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '1px solid #E7E9EE',
          padding: '20px',
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(0,26,72,0.05)',
        }}>
          <p style={{
            margin: '0 0 14px',
            fontSize: 11,
            fontWeight: 700,
            color: '#8A93A1',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Modalidad
          </p>
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {profile.booking_modalidades.map((m) => {
              const selected = modalidad === m
              return (
                <button
                  key={m}
                  onClick={() => onModalidad(m)}
                  style={{
                    background: selected ? '#001a48' : '#F6F7F9',
                    color: selected ? '#fff' : '#374151',
                    border: 'none',
                    borderRadius: 10,
                    padding: '9px 18px',
                    fontSize: 14,
                    fontWeight: selected ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {MODALIDAD_LABELS[m] ?? m}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Continue */}
      <button
        onClick={onNext}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #001a48, #002d72)',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '15px 24px',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '-0.1px',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 4px 14px rgba(0,26,72,0.25)',
        }}
      >
        Elegir fecha →
      </button>
    </div>
  )
}
