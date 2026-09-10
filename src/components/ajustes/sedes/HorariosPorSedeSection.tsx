'use client'

import { useEffect, useState } from 'react'
import { DIAS_SEMANA, crosses, dur, overlapsOf, type Bloque } from '@/lib/sedes/horarios'
import type { HorarioSucursal, Sucursal } from '@/types/database'

const ICON_WARN = (
  <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: '#B42318', strokeWidth: 2, fill: 'none', flexShrink: 0, marginTop: 1 }}>
    <path d="M12 9v4M12 16.5h.01" /><path d="M10.3 3.9 2.6 17.4A1.9 1.9 0 0 0 4.3 20h15.4a1.9 1.9 0 0 0 1.7-2.6L13.7 3.9a1.9 1.9 0 0 0-3.4 0z" />
  </svg>
)
const ICON_INFO = (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--blue)', strokeWidth: 2, fill: 'none', flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
  </svg>
)

type DiasState = Record<number, Bloque[]>

function horariosADias(horarios: HorarioSucursal[]): DiasState {
  const dias: DiasState = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const h of horarios) {
    dias[h.dia_semana] = dias[h.dia_semana] ?? []
    dias[h.dia_semana].push([h.hora_inicio.slice(0, 5), h.hora_fin.slice(0, 5)])
  }
  return dias
}

interface Props {
  sedes: Sucursal[]
  sedeSeleccionadaId: string
  onSeleccionarSede: (id: string) => void
  horariosPorSede: Record<string, HorarioSucursal[]>
  onGuardado: (sedeId: string, horarios: HorarioSucursal[]) => void
}

export default function HorariosPorSedeSection({ sedes, sedeSeleccionadaId, onSeleccionarSede, horariosPorSede, onGuardado }: Props) {
  const sede = sedes.find(s => s.id === sedeSeleccionadaId) ?? sedes[0]
  const [dias, setDias] = useState<DiasState>(() => horariosADias(horariosPorSede[sede?.id] ?? []))
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDias(horariosADias(horariosPorSede[sede?.id] ?? []))
    setGuardado(false)
    setError(null)
  }, [sede?.id, horariosPorSede])

  if (!sede) return null

  function toggleDia(dia: number) {
    setDias(prev => {
      const activo = (prev[dia] ?? []).length > 0
      return { ...prev, [dia]: activo ? [] : [['09:00', '18:00']] }
    })
    setGuardado(false)
  }

  function agregarBloque(dia: number) {
    setDias(prev => ({ ...prev, [dia]: [...(prev[dia] ?? []), ['09:00', '18:00']] }))
    setGuardado(false)
  }

  function quitarBloque(dia: number, idx: number) {
    setDias(prev => {
      const nuevos = (prev[dia] ?? []).filter((_, i) => i !== idx)
      return { ...prev, [dia]: nuevos }
    })
    setGuardado(false)
  }

  function editarBloque(dia: number, idx: number, campo: 0 | 1, valor: string) {
    setDias(prev => {
      const bloques = (prev[dia] ?? []).map((b, i) => {
        if (i !== idx) return b
        const nuevo: Bloque = [...b] as Bloque
        nuevo[campo] = valor
        return nuevo
      })
      return { ...prev, [dia]: bloques }
    })
    setGuardado(false)
  }

  const overlapsPorDia: Record<number, Set<number>> = {}
  let errCount = 0
  let hasCross = false
  for (let d = 0; d < 7; d++) {
    const bloques = dias[d] ?? []
    const bad = overlapsOf(bloques)
    overlapsPorDia[d] = bad
    if (bad.size > 0) errCount++
    bloques.forEach(b => { if (crosses(b)) hasCross = true })
  }

  async function handleSave() {
    setGuardando(true)
    setError(null)
    try {
      const body = {
        dias: Object.entries(dias)
          .filter(([, bloques]) => bloques.length > 0)
          .map(([dia_semana, bloques]) => ({ dia_semana: Number(dia_semana), bloques })),
      }
      const res = await fetch(`/api/sedes/${sede.id}/horarios`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error === 'solapamiento' ? 'Hay bloques que se superponen. Revisá los horarios marcados.' : (data.error ?? 'Error al guardar los horarios'))
        return
      }
      const { data: fresh } = await res.json()
      const nuevosHorarios: HorarioSucursal[] = fresh ?? []
      onGuardado(sede.id, nuevosHorarios)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } finally {
      setGuardando(false)
    }
  }

  function handleDiscard() {
    setDias(horariosADias(horariosPorSede[sede.id] ?? []))
    setError(null)
  }

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 26px', scrollMarginTop: 80 }} id="horarios-sede">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF4E4', color: 'var(--warn)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: 'currentColor', strokeWidth: 1.7, fill: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', margin: 0, color: 'var(--ink)' }}>Horario de {sede.nombre}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.5 }}>Cada sede tiene su propio horario. Podés cargar más de un bloque por día.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {sedes.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSeleccionarSede(s.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 100,
              border: `1px solid ${s.id === sede.id ? 'var(--ink)' : 'var(--border)'}`,
              background: s.id === sede.id ? 'var(--ink)' : 'var(--surface)',
              fontSize: 13, fontWeight: s.id === sede.id ? 600 : 500,
              color: s.id === sede.id ? '#fff' : 'var(--ink-2)', cursor: 'pointer',
            }}
          >
            <i style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'inline-block' }} />
            {s.nombre}
            <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: s.id === sede.id ? 'rgba(255,255,255,.7)' : 'var(--muted-2)' }}>
              {(horariosPorSede[s.id] ?? []).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--blue-soft)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 14 }}>
        {ICON_INFO}
        <span>Los bloques de <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{sede.nombre}</b> se muestran con su color en la agenda y en tu <b style={{ color: 'var(--ink)', fontWeight: 600 }}>link público</b>. Cambiá de sede con las pestañas de arriba.</span>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {DIAS_SEMANA.map((label, i) => {
          const bloques = dias[i] ?? []
          const on = bloques.length > 0
          const bad = overlapsPorDia[i]
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '118px 1fr', alignItems: 'start', gap: 14,
              padding: '11px 12px', border: `1px solid ${bad.size ? '#F0BFBB' : 'var(--border)'}`, borderRadius: 10,
              background: bad.size ? '#FEF7F6' : (on ? 'var(--surface)' : 'var(--surface-2)'),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 500, color: on ? 'var(--ink-2)' : 'var(--muted-2)', paddingTop: 5 }}>
                <button
                  type="button" role="switch" aria-checked={on} aria-label={`${label} activo`}
                  onClick={() => toggleDia(i)}
                  style={{ position: 'relative', width: 32, height: 19, flexShrink: 0, background: on ? 'var(--ink)' : 'var(--border-strong)', borderRadius: 100, cursor: 'pointer', border: 'none', transition: 'background .15s ease' }}
                >
                  <span style={{ position: 'absolute', top: 1.5, left: on ? 15 : 1.5, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s ease', boxShadow: '0 1px 3px rgba(0,0,0,.15)', display: 'block' }} />
                </button>
                {label}
              </div>
              {on ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                  {bloques.map((b, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="time" aria-label={`Inicio bloque ${j + 1} ${label}`} value={b[0]}
                        onChange={e => editarBloque(i, j, 0, e.target.value)}
                        style={{ width: 88, height: 32, padding: '0 8px', border: `1px solid ${bad.has(j) ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 6, font: 'inherit', fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', background: bad.has(j) ? '#FFFBFB' : 'var(--surface)' }}
                      />
                      <span style={{ color: 'var(--muted-2)', fontSize: 12 }}>→</span>
                      <input
                        type="time" aria-label={`Fin bloque ${j + 1} ${label}`} value={b[1]}
                        onChange={e => editarBloque(i, j, 1, e.target.value)}
                        style={{ width: 88, height: 32, padding: '0 8px', border: `1px solid ${bad.has(j) ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 6, font: 'inherit', fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', background: bad.has(j) ? '#FFFBFB' : 'var(--surface)' }}
                      />
                      {crosses(b) ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 100, background: 'var(--amber-soft, #FEF3C7)', color: '#92400E', fontSize: 11, fontWeight: 600 }}>
                          <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                          termina al día siguiente
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, color: 'var(--muted-2)', fontVariantNumeric: 'tabular-nums' }}>{dur(b)}</span>
                      )}
                      <button
                        type="button" aria-label="Quitar bloque" onClick={() => quitarBloque(i, j)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid transparent', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted-2)' }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.9, fill: 'none' }}><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  {bad.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 2, fontSize: 12, color: '#96271C', background: 'var(--danger-soft)', border: '1px solid #F5CFCB', borderRadius: 7, padding: '7px 10px', lineHeight: 1.5 }}>
                      {ICON_WARN}
                      <span><b style={{ fontWeight: 700 }}>Los bloques se superponen.</b> Revisá los horarios marcados en {label.toLowerCase()}. No se puede guardar así.</span>
                    </div>
                  )}
                  <button
                    type="button" onClick={() => agregarBloque(i)}
                    style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontWeight: 500 }}
                  >
                    + Agregar bloque
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--muted-2)', fontStyle: 'italic', paddingTop: 6 }}>No atiendo</div>
              )}
            </div>
          )
        })}
      </div>

      {hasCross && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--amber-soft, #FEF3C7)', border: '1px solid #F0DCAF', fontSize: 12.5, color: '#78350F', lineHeight: 1.55 }}>
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: '#92400E', strokeWidth: 1.9, fill: 'none', flexShrink: 0, marginTop: 1 }}><path d="M12 9v4M12 16.5h.01" /><path d="M10.3 3.9 2.6 17.4A1.9 1.9 0 0 0 4.3 20h15.4a1.9 1.9 0 0 0 1.7-2.6L13.7 3.9a1.9 1.9 0 0 0-3.4 0z" /></svg>
          <span><b style={{ fontWeight: 700 }}>Bloque que cruza la medianoche.</b> Cargá el bloque completo (ej. <b style={{ fontWeight: 700 }}>19:00 → 11:00</b>) y KLIA lo divide solo para el guardado: hasta las 24:00 en el día elegido y desde las 00:00 en el siguiente. El paciente ve una única franja continua.</span>
        </div>
      )}

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {errCount > 0 ? (
          <>
            <button type="button" disabled style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: 0.55, cursor: 'not-allowed' }}>Guardar cambios</button>
            <span style={{ fontSize: 12.5, color: '#96271C', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 500 }}>
              {ICON_WARN}{errCount === 1 ? 'Hay un día con bloques superpuestos' : `Hay ${errCount} días con bloques superpuestos`}
            </span>
          </>
        ) : (
          <>
            <button type="button" onClick={handleSave} disabled={guardando} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'white', opacity: guardando ? 0.7 : 1 }}>
              {guardado ? '✓ Guardado' : guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button type="button" onClick={handleDiscard} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-2)' }}>Descartar</button>
          </>
        )}
      </div>
    </section>
  )
}
