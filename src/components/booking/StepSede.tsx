'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SedePublica } from '@/app/p/[slug]/page'

interface Props {
  slug: string
  tipo: string
  nombreProfesional: string
  sedes: SedePublica[]
  onSede: (sede: SedePublica) => void
  onBack: () => void
}

type ProximoTurno = { fecha: string; hora: string } | null | 'loading'

// Mismos íconos que src/components/ajustes/sedes/SedesSection.tsx (ICON_PIN/ICON_CAM/ICON_CLK)
const ICON_PIN = (
  <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
)
const ICON_CAM = (
  <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}>
    <rect x="2.5" y="6.5" width="12" height="11" rx="2" /><path d="M14.5 11l7-3.5v9l-7-3.5z" />
  </svg>
)
const ICON_CLK = (
  <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: 'currentColor', strokeWidth: 1.9, fill: 'none', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
)
const ICON_INFO = (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--muted-2)', strokeWidth: 1.8, fill: 'none', flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
  </svg>
)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

async function buscarProximoTurno(slug: string, tipo: string, sedeId: string): Promise<{ fecha: string; hora: string } | null> {
  const today = new Date()
  for (let offset = 0; offset < 2; offset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const monthStr = `${y}-${pad(m)}`
    try {
      const res = await fetch(`/api/booking/disponibilidad?slug=${slug}&fecha=${monthStr}&tipo=${tipo}&view=mes&sede_id=${sedeId}`)
      if (!res.ok) continue
      const data = await res.json()
      const days: number[] = (data.availableDays ?? []).slice().sort((a: number, b: number) => a - b)
      if (days.length === 0) continue
      const fecha = `${y}-${pad(m)}-${pad(days[0])}`
      const resDia = await fetch(`/api/booking/disponibilidad?slug=${slug}&fecha=${fecha}&tipo=${tipo}&sede_id=${sedeId}`)
      if (!resDia.ok) continue
      const dataDia = await resDia.json()
      const slots: string[] = dataDia.slots ?? []
      if (slots.length === 0) continue
      return { fecha, hora: slots[0] }
    } catch {
      continue
    }
  }
  return null
}

function formatProximo(p: { fecha: string; hora: string }): string {
  const [y, m, d] = p.fecha.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const fmt = format(date, "EEE d 'de' MMM", { locale: es })
  return `${fmt}, ${p.hora}`
}

export default function StepSede({ slug, tipo, nombreProfesional, sedes, onSede, onBack }: Props) {
  const [proximos, setProximos] = useState<Record<string, ProximoTurno>>(() =>
    Object.fromEntries(sedes.map((s) => [s.id, 'loading']))
  )

  useEffect(() => {
    let cancelled = false
    Promise.all(
      sedes.map(async (s) => {
        const p = await buscarProximoTurno(slug, tipo, s.id)
        return [s.id, p] as const
      })
    ).then((results) => {
      if (cancelled) return
      setProximos(Object.fromEntries(results))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tipo])

  return (
    <div>
      <style jsx>{`
        .sede-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 14px 14px 14px 15px;
          display: flex; align-items: center; gap: 13px;
          text-align: left; width: 100%;
          box-shadow: var(--shadow-sm);
          transition: border-color .14s ease, transform .14s ease, box-shadow .14s ease;
          position: relative; overflow: hidden;
          font-family: Inter, system-ui, sans-serif;
          cursor: pointer;
        }
        .sede-card::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: var(--sc);
        }
        .sede-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--border-strong);
        }
        .sede-card:hover, .sede-card:focus-visible {
          box-shadow: var(--shadow-md), 0 0 0 3px color-mix(in srgb, var(--sc) 16%, transparent);
        }
      `}</style>

      <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.015em' }}>
        ¿Dónde querés atenderte?
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>
        Elegí una sede y vas a ver solamente los horarios que {nombreProfesional} atiende ahí.
      </p>

      <div className="sede-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {sedes.map((sede) => {
          const proximo = proximos[sede.id]
          return (
            <button
              key={sede.id}
              className="sede-card"
              style={{ '--sc': sede.color } as React.CSSProperties}
              onClick={() => onSede(sede)}
            >
              <span style={{
                width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `color-mix(in srgb, ${sede.color} 12%, white)`,
                color: sede.color,
              }}>
                {sede.es_online ? ICON_CAM : ICON_PIN}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.012em' }}>
                  {sede.nombre}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>
                  {sede.es_online ? 'Videoconsulta · link por email' : (sede.direccion || 'Presencial')}
                </span>
                <span style={{
                  fontSize: 11.5, color: 'var(--muted-2)', marginTop: 6,
                  display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                }}>
                  {proximo === 'loading' && 'Buscando próximo turno…'}
                  {proximo && proximo !== 'loading' && (
                    <>
                      {ICON_CLK}
                      próximo turno <b style={{ color: 'var(--green-ink)', fontWeight: 600 }}>{formatProximo(proximo)}</b>
                    </>
                  )}
                  {proximo === null && 'Sin turnos disponibles próximamente'}
                </span>
              </span>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'var(--muted-3)', strokeWidth: 2, fill: 'none', flexShrink: 0 }}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        padding: '12px 14px', borderRadius: 11,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 18,
      }}>
        {ICON_INFO}
        <span>Cada sede tiene sus propios días y horarios. Podés cambiar de sede en cualquier momento antes de confirmar.</span>
      </div>

      <button
        onClick={onBack}
        style={{
          width: '100%',
          background: 'transparent',
          color: 'var(--muted)',
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
  )
}
