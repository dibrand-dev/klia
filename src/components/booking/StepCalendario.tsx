'use client'

import { useState, useEffect, useCallback } from 'react'

interface Props {
  tipo: string
  slug: string
  selectedFecha: string | null
  onFecha: (f: string) => void
  onNext: () => void
  onBack: () => void
}

const DOW_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function firstDayOffset(year: number, month: number): number {
  const d = new Date(year, month - 1, 1).getDay()
  return (d + 6) % 7
}

export default function StepCalendario({
  tipo,
  slug,
  selectedFecha,
  onFecha,
  onNext,
  onBack,
}: Props) {
  const [today] = useState(() => new Date())
  const [viewYear, setViewYear] = useState(() => today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => today.getMonth() + 1)
  const [availableDays, setAvailableDays] = useState<number[]>([])
  const [loading, setLoading] = useState(false)

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
  const offset = firstDayOffset(viewYear, viewMonth)

  const fetchAvailable = useCallback(async () => {
    setLoading(true)
    setAvailableDays([])
    try {
      const monthStr = `${viewYear}-${pad(viewMonth)}`
      const res = await fetch(
        `/api/booking/disponibilidad?slug=${slug}&fecha=${monthStr}&tipo=${tipo}&view=mes`
      )
      if (res.ok) {
        const data = await res.json()
        setAvailableDays(data.availableDays ?? [])
      }
    } catch {
      // silently fail, no days marked as available
    } finally {
      setLoading(false)
    }
  }, [slug, tipo, viewYear, viewMonth])

  useEffect(() => {
    fetchAvailable()
  }, [fetchAvailable])

  function goPrev() {
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth() + 1
    if (viewYear === todayYear && viewMonth === todayMonth) return
    if (viewMonth === 1) {
      setViewMonth(12)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function goNext() {
    if (viewMonth === 12) {
      setViewMonth(1)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()
  const isPrevDisabled = viewYear === todayYear && viewMonth === todayMonth

  const cells: Array<{ day: number | null }> = []
  for (let i = 0; i < offset; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })
  while (cells.length % 7 !== 0) cells.push({ day: null })

  function isPast(day: number): boolean {
    if (viewYear < todayYear) return true
    if (viewYear === todayYear && viewMonth < todayMonth) return true
    if (viewYear === todayYear && viewMonth === todayMonth && day < todayDay) return true
    return false
  }

  function isToday(day: number): boolean {
    return viewYear === todayYear && viewMonth === todayMonth && day === todayDay
  }

  function isSelected(day: number): boolean {
    return selectedFecha === `${viewYear}-${pad(viewMonth)}-${pad(day)}`
  }

  function hasSlots(day: number): boolean {
    return availableDays.includes(day)
  }

  function handleDayClick(day: number) {
    if (isPast(day)) return
    onFecha(`${viewYear}-${pad(viewMonth)}-${pad(day)}`)
  }

  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0B1220', letterSpacing: '-0.015em' }}>
        Elegí una fecha
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5B6472' }}>
        Seleccioná el día que mejor te quede.
      </p>

      {/* Card */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #E7E9EE',
        padding: '22px',
        marginBottom: 18,
        boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
      }}>
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            onClick={goPrev}
            disabled={isPrevDisabled}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: '1px solid #E7E9EE',
              background: isPrevDisabled ? '#F6F7F9' : '#fff',
              cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: isPrevDisabled ? '#AEB5C0' : '#0B1220',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            aria-label="Mes anterior"
          >
            ‹
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0B1220' }}>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </div>
            {loading && (
              <div style={{ fontSize: 11, color: '#AEB5C0', marginTop: 2 }}>Cargando…</div>
            )}
          </div>

          <button
            onClick={goNext}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: '1px solid #E7E9EE',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#0B1220',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        {/* Day of week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {DOW_HEADERS.map((h) => (
            <div key={h} style={{
              textAlign: 'center', fontSize: 11, fontWeight: 600,
              color: '#8A93A1', letterSpacing: '0.04em', padding: '4px 0',
            }}>
              {h}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((cell, i) => {
            if (!cell.day) return <div key={`empty-${i}`} />
            const day = cell.day
            const past = isPast(day)
            const today_ = isToday(day)
            const selected = isSelected(day)
            const slots = hasSlots(day)

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                disabled={past}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: 10,
                  border: today_ && !selected ? '2px solid #2563EB' : '2px solid transparent',
                  background: selected ? '#002d72' : 'transparent',
                  cursor: past ? 'default' : 'pointer',
                  padding: 0,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{
                  fontSize: 14,
                  fontWeight: selected ? 700 : slots ? 600 : 400,
                  color: selected ? '#fff' : past ? '#AEB5C0' : slots ? '#002d72' : '#374151',
                  textDecoration: past ? 'line-through' : 'none',
                }}>
                  {day}
                </span>
                {slots && !selected && !past && (
                  <div style={{
                    position: 'absolute', bottom: 3,
                    width: 4, height: 4, borderRadius: 2, background: '#2563EB',
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Legend — 3 items */}
        <div style={{
          display: 'flex', gap: 16, marginTop: 16, paddingTop: 16,
          borderTop: '1px solid #F1F3F6', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#2563EB' }} />
            <span style={{ fontSize: 11, color: '#8A93A1' }}>Disponible</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#002d72' }} />
            <span style={{ fontSize: 11, color: '#8A93A1' }}>Seleccionado</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#E7E9EE' }} />
            <span style={{ fontSize: 11, color: '#8A93A1' }}>No disponible</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={onNext}
          disabled={!selectedFecha}
          style={{
            width: '100%',
            background: selectedFecha ? 'linear-gradient(135deg, #001a48, #002d72)' : '#E7E9EE',
            color: selectedFecha ? '#fff' : '#AEB5C0',
            border: 'none',
            borderRadius: 10,
            padding: '13px 18px',
            fontSize: 14.5,
            fontWeight: 600,
            cursor: selectedFecha ? 'pointer' : 'not-allowed',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: selectedFecha ? '0 6px 18px rgba(0,45,114,0.25)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          Ver horarios →
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
