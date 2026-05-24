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
      borderRadius: 10,
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

      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: 20,
        border: '1px solid #E7E9EE',
        padding: '20px',
        marginBottom: 16,
        boxShadow: '0 1px 4px rgba(0,26,72,0.05)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <p style={{
            margin: '0 0 4px',
            fontSize: 11,
            fontWeight: 700,
            color: '#8A93A1',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Horarios disponibles
          </p>
          <h2 style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 700,
            color: '#0B1220',
            letterSpacing: '-0.2px',
            textTransform: 'capitalize',
          }}>
            {fechaFmt}
          </h2>
        </div>

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
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#8A93A1',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  ☀️ Mañana
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                }}>
                  {manana.map((slot) => {
                    const selected = selectedHora === slot
                    return (
                      <button
                        key={slot}
                        onClick={() => onHora(slot)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 10,
                          border: selected ? '2px solid #002d72' : '2px solid #E7E9EE',
                          background: selected ? '#002d72' : '#F6F7F9',
                          color: selected ? '#fff' : '#1F2937',
                          fontSize: 14,
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
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#8A93A1',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  🌆 Tarde
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                }}>
                  {tarde.map((slot) => {
                    const selected = selectedHora === slot
                    return (
                      <button
                        key={slot}
                        onClick={() => onHora(slot)}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 10,
                          border: selected ? '2px solid #002d72' : '2px solid #E7E9EE',
                          background: selected ? '#002d72' : '#F6F7F9',
                          color: selected ? '#fff' : '#1F2937',
                          fontSize: 14,
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
          disabled={!selectedHora}
          style={{
            flex: 2,
            background: selectedHora
              ? 'linear-gradient(135deg, #001a48, #002d72)'
              : '#E7E9EE',
            color: selectedHora ? '#fff' : '#AEB5C0',
            border: 'none',
            borderRadius: 14,
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 700,
            cursor: selectedHora ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: selectedHora ? '0 4px 14px rgba(0,26,72,0.25)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
