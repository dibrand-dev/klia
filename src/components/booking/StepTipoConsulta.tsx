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
  videollamada: 'Online',
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
      width: 80, height: 80, borderRadius: 40,
      background: 'linear-gradient(145deg, #E3E9F6, #C9D3E9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28, fontWeight: 700, color: '#16389F',
      boxShadow: '0 8px 20px rgba(16,24,40,0.08)',
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

  return (
    <div>
      {/* Pro card — centered layout */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #E7E9EE',
        padding: '26px 22px 22px',
        marginBottom: 18,
        boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
        textAlign: 'center',
      }}>
        {/* Avatar with verified badge */}
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 14px' }}>
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={`${profile.nombre} ${profile.apellido}`}
              width={80}
              height={80}
              style={{ width: 80, height: 80, borderRadius: 40, objectFit: 'cover', boxShadow: '0 8px 20px rgba(16,24,40,0.08)' }}
            />
          ) : (
            <Initials nombre={profile.nombre} apellido={profile.apellido} />
          )}
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 24, height: 24, borderRadius: 12,
            background: '#2563EB', border: '3px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
        </div>

        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#0B1220', letterSpacing: '-0.3px' }}>
          {profile.nombre} {profile.apellido}
        </h1>
        {profile.especialidad && (
          <p style={{ margin: '0 0 6px', fontSize: 14, color: '#5B6472', fontWeight: 500 }}>
            {profile.especialidad}
          </p>
        )}
        {profile.matricula && (
          <span style={{
            display: 'inline-block',
            fontSize: 11, fontWeight: 600, color: '#8A93A1',
            background: '#F1F3F6', borderRadius: 6, padding: '2px 8px',
            letterSpacing: '0.02em',
          }}>
            Mat. {profile.matricula}
          </span>
        )}
        {profile.booking_bio && (
          <p style={{ margin: '14px 0 0', fontSize: 14, color: '#374151', lineHeight: 1.65, textAlign: 'left' }}>
            {profile.booking_bio}
          </p>
        )}
      </div>

      {/* Session type */}
      <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0B1220', letterSpacing: '-0.015em' }}>
        Tipo de consulta
      </p>
      <div style={{ marginBottom: 18 }}>
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
                  background: selected ? '#F4F7FF' : '#F6F7F9',
                  border: selected ? '2px solid #002d72' : '2px solid transparent',
                  boxShadow: selected ? '0 0 0 3px rgba(0,45,114,0.12)' : 'none',
                  borderRadius: 14,
                  padding: '16px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: selected ? '#1e40af' : '#0B1220', marginBottom: 4 }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: '#5B6472', marginBottom: 8 }}>
                  {opt.desc}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {opt.price !== null ? (
                    <span style={{ fontSize: 16, fontWeight: 700, color: selected ? '#1e40af' : '#0B1220' }}>
                      {formatPrice(opt.price, profile.booking_moneda)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 14, color: '#8A93A1' }}>A confirmar</span>
                  )}
                  <span style={{
                    fontSize: 11, color: '#8A93A1', background: '#fff',
                    borderRadius: 20, padding: '2px 8px', fontWeight: 500,
                  }}>
                    {opt.dur} min
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modality — copied from HTML design */}
      <h2 style={{
        fontSize: 13, fontWeight: 700, color: '#8A93A1',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        margin: '0 0 12px',
      }}>
        Modalidad
      </h2>
      <div style={{
        display: 'flex', gap: 6,
        background: '#FFFFFF', border: '1px solid #E7E9EE',
        padding: 3, borderRadius: 10,
        marginBottom: 24,
      }}>
        {profile.booking_modalidades.map((m) => {
          const selected = modalidad === m
          return (
            <button
              key={m}
              onClick={() => onModalidad(m)}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 7, border: 'none',
                background: selected ? '#0B1220' : 'transparent',
                color: selected ? '#fff' : '#5B6472',
                fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all .12s ease',
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {m === 'presencial' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 10l9-6 9 6v10H3z"/><path d="M9 20v-6h6v6"/>
                </svg>
              )}
              {m === 'videollamada' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>
                </svg>
              )}
              {m === 'telefonica' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              )}
              {MODALIDAD_LABELS[m] ?? m}
            </button>
          )
        })}
      </div>

      {/* Continue */}
      <button
        onClick={onNext}
        style={{
          width: '100%',
          background: 'linear-gradient(135deg, #001a48, #002d72)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '13px 18px',
          fontSize: 14.5,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '-0.1px',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 6px 18px rgba(0,45,114,0.25)',
        }}
      >
        Elegir fecha →
      </button>
    </div>
  )
}
