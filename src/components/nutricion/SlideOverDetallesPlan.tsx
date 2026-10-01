'use client'

import { useEffect, useRef, useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'
import type { PlanAlimentario } from '@/types/database'

interface Props {
  plan: PlanAlimentario
  readOnly: boolean
  open: boolean
  onClose: () => void
  onSaved: () => void | Promise<void>
}

const ICON_X = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M6 6l12 12M18 6l-12 12" /></svg>
const ICON_PLUS = <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M12 5v14M5 12h14" /></svg>
const ICON_ARROW = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
const ICON_EYE = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.9, fill: 'none' }}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></svg>

const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

function dayDiff(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000)
}

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

interface Indicacion { id: number; texto: string }

// Ids estables por línea (no el índice del array) — con key={i}, insertar una
// línea en el medio hacía que React reconciliara por posición y reutilizara
// el nodo <input> ya enfocado para la fila nueva en vez de crear uno propio:
// el foco visualmente "no se movía" y el texto tipeado después terminaba
// mezclado con la línea de al lado. Con un id propio por línea, cada fila es
// su propio nodo DOM sin importar dónde se inserte o borre.
function lineasDesdeTexto(texto: string | null, nextId: () => number): Indicacion[] {
  if (!texto) return []
  return texto.split('\n').filter((s) => s.trim() !== '').map((t) => ({ id: nextId(), texto: t }))
}

export default function SlideOverDetallesPlan({ plan, readOnly, open, onClose, onSaved }: Props) {
  const [objetivo, setObjetivo] = useState(plan.objetivo_titulo ?? '')
  const [objetivoNota, setObjetivoNota] = useState(plan.objetivo_nota ?? '')
  const [fechaFin, setFechaFin] = useState(plan.fecha_fin ?? '')
  const [mostrarMacros, setMostrarMacros] = useState(plan.mostrar_macros_paciente)
  const idCounterRef = useRef(0)
  const nextId = () => idCounterRef.current++
  const [indicaciones, setIndicaciones] = useState<Indicacion[]>(() => lineasDesdeTexto(plan.indicaciones, nextId))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputsRef = useRef<Map<number, HTMLInputElement | null>>(new Map())

  useEffect(() => {
    if (!open) return
    setObjetivo(plan.objetivo_titulo ?? '')
    setObjetivoNota(plan.objetivo_nota ?? '')
    setFechaFin(plan.fecha_fin ?? '')
    setMostrarMacros(plan.mostrar_macros_paciente)
    setIndicaciones(lineasDesdeTexto(plan.indicaciones, nextId))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan.id, plan.objetivo_titulo, plan.objetivo_nota, plan.fecha_fin, plan.indicaciones, plan.mostrar_macros_paciente])

  const inicioISO = plan.created_at.slice(0, 10)
  const dias = fechaFin ? dayDiff(inicioISO, fechaFin) : null
  const fechaInvalida = dias != null && dias < 0
  const vigenciaHelp = !fechaFin
    ? 'Sin fecha de fin, el PDF muestra solo la fecha de inicio.'
    : fechaInvalida
      ? 'La fecha de fin es anterior al inicio del plan.'
      : `${dias} días${(dias ?? 0) >= 14 ? ` (unas ${Math.round((dias ?? 0) / 7)} semanas)` : ''}. En el PDF: «Del ${fmtFecha(plan.created_at)} al ${fmtFecha(`${fechaFin}T12:00:00`)}».`

  function agregarIndicacion(at: number) {
    const id = nextId()
    setIndicaciones((prev) => {
      const next = [...prev]
      next.splice(at, 0, { id, texto: '' })
      return next
    })
    setTimeout(() => inputsRef.current.get(id)?.focus(), 0)
  }

  function actualizarIndicacion(id: number, v: string) {
    setIndicaciones((prev) => prev.map((ind) => (ind.id === id ? { ...ind, texto: v } : ind)))
  }

  function quitarIndicacion(id: number) {
    setIndicaciones((prev) => {
      const idx = prev.findIndex((ind) => ind.id === id)
      const anterior = prev[Math.max(0, idx - 1)]
      const next = prev.filter((ind) => ind.id !== id)
      if (anterior && anterior.id !== id) setTimeout(() => inputsRef.current.get(anterior.id)?.focus(), 0)
      return next
    })
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/planes-alimentarios/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objetivo_titulo: objetivo.trim(),
          objetivo_nota: objetivoNota.trim(),
          fecha_fin: fechaFin || null,
          indicaciones: indicaciones.map((ind) => ind.texto.trim()).filter(Boolean).join('\n'),
          mostrar_macros_paciente: mostrarMacros,
        }),
      })
      const data = await jsonOrNull(res)
      if (!res.ok || data?.error) {
        setError(data?.error ?? 'Error al guardar los detalles')
        setGuardando(false)
        return
      }
      await onSaved()
      onClose()
    } catch {
      setError('Error de conexión. Intentá nuevamente.')
      setGuardando(false)
    }
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Detalles del plan"
      subtitle={plan.nombre}
      width="md"
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', padding: '12px 16px', background: 'var(--surface-2, #F6F7F9)', borderTop: '1px solid var(--border, #E7E9EE)' }}>
          <button type="button" onClick={onClose} className="btn" style={{ flex: 1, justifyContent: 'center' }}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
          {!readOnly && (
            <button type="button" onClick={guardar} disabled={guardando || fechaInvalida} className="btn primary" style={{ flex: 1, justifyContent: 'center', opacity: (guardando || fechaInvalida) ? 0.6 : 1 }}>
              Guardar
            </button>
          )}
        </div>
      }
    >
      {readOnly && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--r-md, 8px)', background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted, #5B6472)', marginBottom: 20 }}>
          <span style={{ flexShrink: 0, marginTop: 2 }}>{ICON_EYE}</span>
          <span><b style={{ color: 'var(--ink-2, #1F2937)' }}>Solo lectura.</b> {plan.estado === 'archivado' ? 'Este plan está archivado' : 'Es un plan anterior'}: los detalles se conservan como se entregaron al paciente.</span>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Objetivo del plan <span style={optStyle}>opcional</span></label>
        <input
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          readOnly={readOnly}
          maxLength={60}
          placeholder="Ej.: Mantenimiento de peso"
          style={{ ...inpStyle, height: 42, fontSize: 14.5, ...(readOnly ? roInpStyle : {}) }}
        />
        <textarea
          value={objetivoNota}
          onChange={(e) => setObjetivoNota(e.target.value)}
          readOnly={readOnly}
          rows={3}
          placeholder="Contale en pocas palabras qué buscan con este plan."
          style={{ ...inpStyle, height: 'auto', minHeight: 86, padding: '10px 11px', resize: 'vertical', lineHeight: 1.5, fontSize: 13.5, marginTop: 8, display: 'block', ...(readOnly ? roInpStyle : {}) }}
        />
        <p style={helpStyle}>En el PDF va arriba de todo, debajo del saludo al paciente.</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Vigencia <span style={optStyle}>opcional</span></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 16px minmax(0,1fr)', gap: 8, alignItems: 'end' }}>
          <div>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted, #5B6472)', marginBottom: 5 }}>Inicio</span>
            <div style={{ height: 42, display: 'flex', alignItems: 'center', padding: '0 11px', borderRadius: 'var(--r-md, 8px)', background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)', fontSize: 14, color: 'var(--ink-2, #1F2937)' }}>
              {fmtFecha(plan.created_at)}
            </div>
          </div>
          <div style={{ height: 42, display: 'grid', placeItems: 'center', color: 'var(--muted-3, #AEB5C0)' }}>{ICON_ARROW}</div>
          <div>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted, #5B6472)', marginBottom: 5 }}>Fin</span>
            <input
              type="date"
              value={fechaFin ?? ''}
              min={inicioISO}
              onChange={(e) => setFechaFin(e.target.value)}
              readOnly={readOnly}
              style={{ ...inpStyle, height: 42, fontSize: 14.5, ...(readOnly ? roInpStyle : {}) }}
            />
          </div>
        </div>
        <p style={{ ...helpStyle, color: fechaInvalida ? 'var(--danger, #B42318)' : 'var(--muted-2, #8A93A1)' }}>{vigenciaHelp}</p>
        <p style={{ ...helpStyle, marginTop: 2 }}>El inicio es la fecha de creación del plan y no se edita.</p>
      </div>

      <div style={{ marginBottom: 6 }}>
        <label style={labelStyle}>Indicaciones para arrancar {indicaciones.length > 0 && <span style={cntStyle}>{indicaciones.length}</span>}</label>
        {indicaciones.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {indicaciones.map((ind, i) => (
              <div key={ind.id} style={{ display: 'grid', gridTemplateColumns: readOnly ? '16px minmax(0,1fr)' : '16px minmax(0,1fr) 28px', gap: 9, alignItems: 'center' }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, border: '1.5px solid var(--border-strong, #D6DAE1)' }} />
                <input
                  ref={(el) => { inputsRef.current.set(ind.id, el) }}
                  value={ind.texto}
                  onChange={(e) => actualizarIndicacion(ind.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); agregarIndicacion(i + 1) }
                    if (e.key === 'Backspace' && !ind.texto) { e.preventDefault(); quitarIndicacion(ind.id) }
                  }}
                  readOnly={readOnly}
                  maxLength={90}
                  placeholder="Ej.: Tomá un vaso de agua al levantarte"
                  style={{ ...inpStyle, height: 38, fontSize: 13.5, ...(readOnly ? roInpStyle : {}) }}
                />
                {!readOnly && (
                  <button type="button" onClick={() => quitarIndicacion(ind.id)} title="Quitar" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid transparent', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--danger, #B42318)' }}>{ICON_X}</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--muted-2, #8A93A1)', margin: '0 0 10px' }}>{readOnly ? 'Este plan no tenía indicaciones.' : 'Todavía no hay indicaciones.'}</p>
        )}
        {!readOnly && (
          <button type="button" onClick={() => agregarIndicacion(indicaciones.length)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 100, border: '1px dashed var(--border-strong, #D6DAE1)', background: 'transparent', fontSize: 12.5, fontWeight: 500, color: 'var(--muted, #5B6472)', cursor: 'pointer' }}>
            {ICON_PLUS}Agregar indicación
          </button>
        )}
        <p style={helpStyle}>Una por línea, cortas y accionables. En el PDF salen como checklist.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0 2px', borderTop: '1px solid var(--border, #E7E9EE)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink, #0B1220)' }}>Mostrar distribución de macros al paciente</div>
          <p style={{ ...helpStyle, marginTop: 3 }}>Afecta solo lo que ve el paciente en el link público. El dato se sigue calculando y mostrando en el editor.</p>
        </div>
        <button
          type="button"
          onClick={() => !readOnly && setMostrarMacros((v) => !v)}
          disabled={readOnly}
          aria-pressed={mostrarMacros}
          style={{
            position: 'relative', width: 38, height: 22, flexShrink: 0, border: 'none',
            background: mostrarMacros ? 'var(--ink, #0B1220)' : 'var(--border-strong, #D6DAE1)',
            borderRadius: 100, cursor: readOnly ? 'default' : 'pointer', transition: 'background .15s ease',
            opacity: readOnly ? 0.6 : 1,
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: mostrarMacros ? 18 : 2, width: 18, height: 18, borderRadius: '50%',
            background: '#fff', transition: 'left .15s ease', boxShadow: '0 1px 3px rgba(0,0,0,.15)', display: 'block',
          }} />
        </button>
      </div>

      {error && <p style={{ fontSize: 12.5, color: 'var(--danger, #B42318)', marginTop: 14 }}>{error}</p>}
    </SlideOver>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted-2, #8A93A1)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7 }
const optStyle: React.CSSProperties = { fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted-3, #AEB5C0)', marginLeft: 4 }
const cntStyle: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: 'var(--muted-3, #AEB5C0)', marginLeft: 4, textTransform: 'none', letterSpacing: 0 }
const helpStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', marginTop: 7, lineHeight: 1.5 }
const inpStyle: React.CSSProperties = { width: '100%', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)', padding: '0 11px', font: 'inherit', color: 'var(--ink, #0B1220)', background: 'var(--surface, #fff)', outline: 'none' }
const roInpStyle: React.CSSProperties = { pointerEvents: 'none', background: 'var(--surface-2, #F6F7F9)', color: 'var(--ink-2, #1F2937)' }
