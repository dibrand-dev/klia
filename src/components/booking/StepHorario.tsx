'use client'

import { useState, useEffect } from 'react'

interface Props {
  slug: string
  fecha: string
  tipo: string
  selectedHora: string | null
  onHora: (h: string) => void
  onNext: () => void
  onBack: () => void
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

function SlotSkeleton() {
  return (
    <div style={{
      height: 40,
      borderRadius: 9,
      background: 'linear-gradient(90deg, #F1F3F6 25%, #E7E9EE 50%, #F1F3F6 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function StepHorario({
  slug,
  fecha,
  tipo,
  selectedHora,
  onHora,
  onNext,
  onBack,
}: Props) {
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setSlots([])

    fetch(`/api/booking/disponibilidad?slug=${slug}&fecha=${fecha}&tipo=${tipo}`)
      .then((r) => {
        if (!r.ok) throw new Error('error')
        return r.json()
      })
      .then((data) => {
        if (!cancelled) {
          setSlots(data.slots ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [slug, fecha, tipo])

  const manana = slots.filter((s) => {
    const [h] = s.split(':').map(Number)
    return h < 13
  })
  const tarde = slots.filter((s) => {
    const [h] = s.split(':').map(Number)
    return h >= 13
  })

  const fechaFmt = formatFecha(fecha)

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <p style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: '#0B1220', letterSpacing: '-0.015em' }}>
        Elegí tu horario
      </p>

      {/* Date badge */}
      <div style={{ marginBottom: 16 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 100,
          background: '#EFF4FF', color: '#2563EB',
          fontSize: 12.5, fontWeight: 500,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M8 2v4M16 2v4M3 10h18"/>
          </svg>
          <span style={{ textTransform: 'capitalize' }}>{fechaFmt}</span>
        </span>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #E7E9EE',
        padding: '22px',
        marginBottom: 18,
        boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
      }}>
        {loading && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8A93A1', marginBottom: 10 }}>Mañana</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {Array.from({ length: 4 }).map((_, i) => <SlotSkeleton key={i} />)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8A93A1', marginBottom: 10 }}>Tarde</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {Array.from({ length: 4 }).map((_, i) => <SlotSkeleton key={i} />)}
              </div>
            </div>
          </div>
        )}

        {!loading && error && (
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: '#5B6472',
            fontSize: 14,
          }}>
            No se pudieron cargar los horarios. Por favor intentá nuevamente.
          </div>
        )}

        {!loading && !error && slots.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📅</div>
            <p style={{ margin: 0, fontSize: 14, color: '#5B6472', lineHeight: 1.6 }}>
              No hay horarios disponibles para este día.
              <br />Volvé al calendario y elegí otra fecha.
            </p>
          </div>
        )}

        {!loading && !error && slots.length > 0 && (
          <div>
            {manana.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 600, color: '#8A93A1',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                  </svg>
                  Mañana
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {manana.map((slot) => {
                    const selected = selectedHora === slot
                    return (
                      <button
                        key={slot}
                        onClick={() => onHora(slot)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 9,
                          border: selected ? '2px solid #002d72' : '2px solid #E7E9EE',
                          background: selected ? '#002d72' : '#F6F7F9',
                          color: selected ? '#fff' : '#1F2937',
                          fontSize: 13.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: '"JetBrains Mono", "Courier New", monospace',
                          transition: 'all 0.12s',
                          textAlign: 'center',
                        }}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {tarde.length > 0 && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 600, color: '#8A93A1',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                  </svg>
                  Tarde
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {tarde.map((slot) => {
                    const selected = selectedHora === slot
                    return (
                      <button
                        key={slot}
                        onClick={() => onHora(slot)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 9,
                          border: selected ? '2px solid #002d72' : '2px solid #E7E9EE',
                          background: selected ? '#002d72' : '#F6F7F9',
                          color: selected ? '#fff' : '#1F2937',
                          fontSize: 13.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: '"JetBrains Mono", "Courier New", monospace',
                          transition: 'all 0.12s',
                          textAlign: 'center',
                        }}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={onNext}
          disabled={!selectedHora}
          style={{
            width: '100%',
            background: selectedHora ? 'linear-gradient(135deg, #001a48, #002d72)' : '#E7E9EE',
            color: selectedHora ? '#fff' : '#AEB5C0',
            border: 'none',
            borderRadius: 10,
            padding: '13px 18px',
            fontSize: 14.5,
            fontWeight: 600,
            cursor: selectedHora ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: selectedHora ? '0 6px 18px rgba(0,45,114,0.25)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          Continuar →
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
