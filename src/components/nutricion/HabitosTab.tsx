'use client'

import { useEffect, useRef, useState } from 'react'
import type { Paciente, HabitoComida, HabitosGenerales } from '@/types/database'

type ComidaKey = 'desayuno' | 'colacion1' | 'almuerzo' | 'colacion2' | 'merienda' | 'cena'

const MEALS: [ComidaKey, string][] = [
  ['desayuno', 'Desayuno'],
  ['colacion1', 'Colación 1'],
  ['almuerzo', 'Almuerzo'],
  ['colacion2', 'Colación 2'],
  ['merienda', 'Merienda'],
  ['cena', 'Cena'],
]

const PLACEHOLDER: Record<ComidaKey, string> = {
  desayuno: 'ej.: café con leche, tostadas de pan integral con queso untable',
  colacion1: 'ej.: fruta de estación o puñado de frutos secos',
  almuerzo: 'ej.: pollo al horno con arroz y ensalada de hoja verde',
  colacion2: 'ej.: yogur con avena / galletas de arroz con palta',
  merienda: 'ej.: mate con 2 vainillas, a veces batido de fruta con avena',
  cena: 'ej.: sopa con fideos y verduras, tortilla de zapallito',
}

const FREQ = ['', 'Nunca', 'Ocasionalmente (menos de 1 vez por semana)', '1 a 2 veces por semana', '3 a 4 veces por semana', '5 a 6 veces por semana', 'Todos los días']
const DRUGS_OPCIONES = ['', 'No consume', 'Consumo ocasional', 'Consumo frecuente', 'Prefiere no responder']

type HState = {
  week: Partial<Record<ComidaKey, string>>
  wknd: Partial<Record<ComidaKey, string>>
  desc: Partial<Record<ComidaKey, string>>
  notes: string
  act: { on: boolean | null; freq: string; type: string }
  water: { qty: string; unit: string }
  sleep: string
  soda: string
  alcohol: string
  drugs: { v: string; note: string }
  tob: { on: boolean | null; qty: string }
  updated: string | null
}

function blank(): HState {
  return {
    week: {}, wknd: {}, desc: {}, notes: '',
    act: { on: null, freq: '', type: '' },
    water: { qty: '', unit: 'litros' },
    sleep: '',
    soda: '', alcohol: '',
    drugs: { v: '', note: '' },
    tob: { on: null, qty: '' },
    updated: null,
  }
}

function fromApi(comidas: HabitoComida[], generales: HabitosGenerales | null): HState {
  const h = blank()
  for (const c of comidas) {
    const k = c.comida as ComidaKey
    if (c.hora_semana) h.week[k] = c.hora_semana.slice(0, 5)
    if (c.hora_finde) h.wknd[k] = c.hora_finde.slice(0, 5)
    if (c.descripcion) h.desc[k] = c.descripcion
  }
  if (generales) {
    h.act = { on: generales.actividad_fisica, freq: generales.actividad_frecuencia_dias?.toString() ?? '', type: generales.actividad_tipo ?? '' }
    h.water = { qty: generales.agua_cantidad?.toString() ?? '', unit: generales.agua_unidad ?? 'litros' }
    h.sleep = generales.sueno_horas?.toString() ?? ''
    h.soda = generales.gaseosas_frecuencia ?? ''
    h.alcohol = generales.alcohol_frecuencia ?? ''
    h.tob = { on: generales.tabaco, qty: generales.tabaco_cantidad?.toString() ?? '' }
    h.drugs = { v: generales.drogas_consumo ?? '', note: generales.drogas_detalle ?? '' }
    h.notes = generales.notas_generales ?? ''
    h.updated = generales.updated_at ? fmtFecha(generales.updated_at) : null
  }
  return h
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function counts(h: HState) {
  let done = 0
  const total = 11
  if (MEALS.some(([k]) => h.week[k])) done++
  if (MEALS.some(([k]) => h.wknd[k])) done++
  if (MEALS.some(([k]) => (h.desc[k] ?? '').trim())) done++
  if (h.act.on !== null) done++
  if (h.water.qty !== '') done++
  if (h.sleep !== '') done++
  if (h.soda) done++
  if (h.alcohol) done++
  if (h.tob.on !== null) done++
  if (h.drugs.v) done++
  if (h.notes.trim()) done++
  return { done, total }
}

const ICON_PLUS = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M12 5v14M5 12h14" /></svg>
const ICON_COPY = <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', strokeWidth: 1.9, fill: 'none' }}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 6H6a2 2 0 0 0-2 2v9" /></svg>
const ICON_CHECK = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>
const ICON_CLOCK = <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--muted-2, #8A93A1)', strokeWidth: 1.9, fill: 'none' }}><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /></svg>
const ICON_EMPTY = <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: 'var(--accent-ink, #1F4FD9)', strokeWidth: 1.7, fill: 'none' }}><path d="M9 3h6l1 3H8l1-3z" /><path d="M6 6h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6z" /><path d="M10 12h4" /></svg>

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

export default function HabitosTab({ paciente }: { paciente: Paciente }) {
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)
  const [h, setH] = useState<HState>(blank())
  const [savedJson, setSavedJson] = useState<string>(JSON.stringify(blank()))
  const [guardando, setGuardando] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  function toast(msg: string) {
    setToastMsg(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600)
  }

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setLoading(true)
      const res = await fetch(`/api/habitos/${paciente.id}`)
      const data = await jsonOrNull(res)
      if (cancelado) return
      const comidas = (data?.comidas ?? []) as HabitoComida[]
      const generales = (data?.generales ?? null) as HabitosGenerales | null
      const inicial = fromApi(comidas, generales)
      setH(inicial)
      setSavedJson(JSON.stringify(inicial))
      setStarted(comidas.length > 0 || generales !== null)
      setLoading(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [paciente.id])

  const dirty = JSON.stringify(h) !== savedJson
  const { done, total } = counts(h)

  async function handleGuardar() {
    setGuardando(true)
    try {
      const body = {
        comidas: MEALS.map(([k]) => ({
          comida: k,
          hora_semana: h.week[k] || null,
          hora_finde: h.wknd[k] || null,
          descripcion: h.desc[k] || null,
        })),
        generales: {
          actividad_fisica: h.act.on,
          actividad_frecuencia_dias: h.act.freq ? Number(h.act.freq) : null,
          actividad_tipo: h.act.type || null,
          agua_cantidad: h.water.qty ? Number(h.water.qty) : null,
          agua_unidad: h.water.unit || null,
          sueno_horas: h.sleep ? Number(h.sleep) : null,
          gaseosas_frecuencia: h.soda || null,
          alcohol_frecuencia: h.alcohol || null,
          tabaco: h.tob.on,
          tabaco_cantidad: h.tob.qty ? Number(h.tob.qty) : null,
          drogas_consumo: h.drugs.v || null,
          drogas_detalle: h.drugs.note || null,
          notas_generales: h.notes || null,
        },
      }
      const res = await fetch(`/api/habitos/${paciente.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await jsonOrNull(res)
      if (!res.ok || data?.error) {
        toast(data?.error ?? 'Error al guardar los hábitos')
        return
      }
      const comidas = (data?.comidas ?? []) as HabitoComida[]
      const generales = (data?.generales ?? null) as HabitosGenerales | null
      const nuevo = fromApi(comidas, generales)
      setH(nuevo)
      setSavedJson(JSON.stringify(nuevo))
      const { done: d, total: t } = counts(nuevo)
      toast(d < t ? `Guardado. Faltan ${t - d} bloques por relevar.` : 'Relevamiento guardado.')
    } finally {
      setGuardando(false)
    }
  }

  function handleDescartar() {
    const prev = JSON.parse(savedJson) as HState
    setH(prev)
    toast('Cambios descartados.')
  }

  function copiarAFinde() {
    setH((prev) => ({ ...prev, wknd: { ...prev.week } }))
    toast('Horarios copiados al fin de semana.')
  }

  if (loading) {
    return <p style={{ padding: 20, fontSize: 13, color: 'var(--muted, #8A93A1)' }}>Cargando...</p>
  }

  let tagLabel = 'Sin relevar'
  let tagStyle: React.CSSProperties = { background: 'var(--surface-3, #F1F3F6)', color: 'var(--muted, #5B6472)' }
  if (started || done > 0) {
    if (done === total) {
      tagLabel = 'Relevamiento completo'
      tagStyle = { background: 'var(--ok-soft, #DFF3E8)', color: '#17663F' }
    } else {
      tagLabel = `Relevamiento parcial · ${done} de ${total} bloques`
      tagStyle = { background: 'var(--accent-soft, #EAF0FE)', color: 'var(--accent-ink, #1F4FD9)' }
    }
  }

  return (
    <div style={{ padding: '4px 0 100px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink, #0B1220)' }}>Hábitos</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 5, fontSize: 12.5, color: 'var(--muted, #5B6472)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 100, ...tagStyle }}>{tagLabel}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-3, #AEB5C0)' }} />
            <span>{h.updated ? `Actualizado ${h.updated}` : 'Nunca guardado'}</span>
          </div>
        </div>
      </div>

      {toastMsg && (
        <div style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: '#0B1220', color: '#fff', fontSize: 12.5, padding: '9px 15px', borderRadius: 100, boxShadow: '0 14px 34px rgba(11,18,32,.3)', zIndex: 70, maxWidth: '86vw', textAlign: 'center' }}>
          {toastMsg}
        </div>
      )}

      {!started ? (
        <div style={{ background: 'var(--surface, #fff)', border: '1px dashed var(--border-strong, #D6DAE1)', borderRadius: 'var(--r-xl, 16px)', padding: '44px 26px', textAlign: 'center' }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--accent-soft, #EAF0FE)', display: 'grid', placeItems: 'center', margin: '0 auto 15px' }}>{ICON_EMPTY}</div>
          <h3 style={{ margin: '0 0 6px', fontSize: 15.5, fontWeight: 600, color: 'var(--ink, #0B1220)' }}>Todavía no relevaste los hábitos de {paciente.nombre}</h3>
          <p style={{ margin: '0 auto 18px', fontSize: 13, color: 'var(--muted, #5B6472)', maxWidth: 420, lineHeight: 1.6 }}>
            Se completa en consulta: recordatorio de 24 horas — horarios y qué come en cada comida, entre semana y fin de semana — más actividad física, hidratación, consumos y sueño. No hace falta tener todo — podés guardar lo que sepas y seguir después.
          </p>
          <button type="button" onClick={() => setStarted(true)} className="btn primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {ICON_PLUS}Comenzar relevamiento
          </button>
        </div>
      ) : (
        <>
          <section style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-lg, 12px)', boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(16,24,40,.04))', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '15px 18px 14px', borderBottom: '1px solid var(--border, #E7E9EE)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 190 }}>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.012em', color: 'var(--ink, #0B1220)' }}>Horarios de comida</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--muted-2, #8A93A1)', lineHeight: 1.5 }}>Recordatorio de 24 horas: a qué hora come y qué consume habitualmente. Dejá vacía la comida que el paciente no realiza.</p>
              </div>
              <button
                type="button" onClick={copiarAFinde}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', font: 'inherit', fontSize: 12.5, fontWeight: 500, color: 'var(--accent-ink, #1F4FD9)', padding: '5px 8px', margin: '-5px -8px', borderRadius: 'var(--r-sm, 6px)', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-soft, #EAF0FE)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {ICON_COPY}Copiar días de semana al fin de semana
              </button>
            </div>
            <div style={{ padding: '16px 18px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 128px 128px', gap: 12, padding: '0 0 7px' }}>
                <div />
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted-2, #8A93A1)' }}>Días de semana</div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted-2, #8A93A1)' }}>Fin de semana</div>
              </div>
              {MEALS.map(([k, label], i) => {
                const filled = !!(h.week[k] || h.wknd[k] || (h.desc[k] ?? '').trim())
                return (
                  <div key={k} style={{ padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid var(--surface-3, #F1F3F6)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) 128px 128px', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 13.5, color: 'var(--ink-2, #1F2937)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok, #10B981)', flexShrink: 0, opacity: filled ? 1 : 0 }} />
                        {label}
                      </div>
                      <input
                        type="time" aria-label={`${label} — horario días de semana`}
                        value={h.week[k] ?? ''}
                        onChange={(e) => setH((prev) => ({ ...prev, week: { ...prev.week, [k]: e.target.value } }))}
                        style={timeInpStyle}
                      />
                      <input
                        type="time" aria-label={`${label} — horario fin de semana`}
                        value={h.wknd[k] ?? ''}
                        onChange={(e) => setH((prev) => ({ ...prev, wknd: { ...prev.wknd, [k]: e.target.value } }))}
                        style={timeInpStyle}
                      />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        rows={2}
                        aria-label={`${label} — qué consume habitualmente`}
                        placeholder={`Qué come habitualmente — ${PLACEHOLDER[k]}`}
                        value={h.desc[k] ?? ''}
                        onChange={(e) => setH((prev) => ({ ...prev, desc: { ...prev.desc, [k]: e.target.value } }))}
                        style={textareaStyle}
                      />
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--surface-3, #F1F3F6)', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2, #1F2937)' }}>Notas generales</label>
                <textarea
                  rows={4}
                  placeholder="Observaciones del recordatorio de 24 horas — picoteo entre comidas, quien cocina en casa, salidas, apetito, diferencias del fin de semana"
                  value={h.notes}
                  onChange={(e) => setH((prev) => ({ ...prev, notes: e.target.value }))}
                  style={{ ...textareaStyle, minHeight: 100 }}
                />
              </div>
              <SchedFoot h={h} />
            </div>
          </section>

          <section style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-lg, 12px)', boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(16,24,40,.04))', marginBottom: 16 }}>
            <div style={{ padding: '15px 18px 14px', borderBottom: '1px solid var(--border, #E7E9EE)' }}>
              <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.012em', color: 'var(--ink, #0B1220)' }}>Hábitos generales</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--muted-2, #8A93A1)', lineHeight: 1.5 }}>Datos de relevamiento. Podés completar solo lo que ya sabés y volver después.</p>
            </div>
            <div style={{ padding: '16px 18px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '2px 24px' }}>
                <Fld wide filled={h.act.on !== null}>
                  <span style={fldLabelStyle}><FilledDot on={h.act.on !== null} />Realiza actividad física</span>
                  <YesNo
                    value={h.act.on}
                    onChange={(v) => setH((prev) => ({ ...prev, act: v === prev.act.on ? { on: null, freq: '', type: '' } : { ...prev.act, on: v } }))}
                  />
                  {h.act.on === true && (
                    <div style={subStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          type="number" min={0} max={7} step={1} placeholder="—" aria-label="Días por semana"
                          value={h.act.freq}
                          onChange={(e) => setH((prev) => ({ ...prev, act: { ...prev.act, freq: e.target.value } }))}
                          style={{ ...numInpStyle }}
                        />
                        <span style={{ fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>días por semana</span>
                      </div>
                      <input
                        maxLength={60} placeholder="Tipo de actividad — ej.: caminata, funcional, natación" aria-label="Tipo de actividad"
                        value={h.act.type}
                        onChange={(e) => setH((prev) => ({ ...prev, act: { ...prev.act, type: e.target.value } }))}
                        style={{ ...inpStyle, width: '100%', minWidth: 150 }}
                      />
                    </div>
                  )}
                </Fld>

                <Fld filled={h.water.qty !== ''}>
                  <label style={fldLabelStyle}><FilledDot on={h.water.qty !== ''} />Consumo de agua por día</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="number" min={0} step={0.25} placeholder="—"
                      value={h.water.qty}
                      onChange={(e) => setH((prev) => ({ ...prev, water: { ...prev.water, qty: e.target.value } }))}
                      style={numInpStyle}
                    />
                    <select
                      aria-label="Unidad" value={h.water.unit}
                      onChange={(e) => setH((prev) => ({ ...prev, water: { ...prev.water, unit: e.target.value } }))}
                      style={selectStyle}
                    >
                      <option value="litros">litros</option>
                      <option value="vasos">vasos (250 ml)</option>
                    </select>
                  </div>
                </Fld>

                <Fld filled={h.sleep !== ''}>
                  <label style={fldLabelStyle}><FilledDot on={h.sleep !== ''} />Tiempo de sueño</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="number" min={0} max={16} step={0.5} placeholder="—"
                      value={h.sleep}
                      onChange={(e) => setH((prev) => ({ ...prev, sleep: e.target.value }))}
                      style={numInpStyle}
                    />
                    <span style={{ fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>horas por noche aprox.</span>
                  </div>
                </Fld>

                <Fld filled={!!h.soda}>
                  <label style={fldLabelStyle}><FilledDot on={!!h.soda} />Consumo de gaseosas</label>
                  <select value={h.soda} onChange={(e) => setH((prev) => ({ ...prev, soda: e.target.value }))} style={{ ...selectStyle, width: '100%' }}>
                    {FREQ.map((f) => <option key={f} value={f}>{f || 'Sin dato'}</option>)}
                  </select>
                </Fld>

                <Fld filled={!!h.alcohol}>
                  <label style={fldLabelStyle}><FilledDot on={!!h.alcohol} />Consumo de alcohol</label>
                  <select value={h.alcohol} onChange={(e) => setH((prev) => ({ ...prev, alcohol: e.target.value }))} style={{ ...selectStyle, width: '100%' }}>
                    {FREQ.map((f) => <option key={f} value={f}>{f || 'Sin dato'}</option>)}
                  </select>
                </Fld>

                <Fld wide filled={!!h.drugs.v}>
                  <label style={fldLabelStyle}><FilledDot on={!!h.drugs.v} />Consumo de drogas</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      value={h.drugs.v} style={{ ...selectStyle, minWidth: 200 }}
                      onChange={(e) => {
                        const v = e.target.value
                        setH((prev) => ({ ...prev, drugs: { v, note: (!v || v === 'No consume' || v === 'Prefiere no responder') ? '' : prev.drugs.note } }))
                      }}
                    >
                      {DRUGS_OPCIONES.map((f) => <option key={f} value={f}>{f || 'Sin dato'}</option>)}
                    </select>
                    {!!h.drugs.v && h.drugs.v !== 'No consume' && h.drugs.v !== 'Prefiere no responder' && (
                      <input
                        maxLength={80} placeholder="Detalle — sustancia y frecuencia aproximada" aria-label="Detalle de consumo de drogas"
                        value={h.drugs.note}
                        onChange={(e) => setH((prev) => ({ ...prev, drugs: { ...prev.drugs, note: e.target.value } }))}
                        style={{ ...inpStyle, flex: '1 1 auto', width: '100%', minWidth: 150 }}
                      />
                    )}
                  </div>
                </Fld>

                <Fld wide filled={h.tob.on !== null}>
                  <span style={fldLabelStyle}><FilledDot on={h.tob.on !== null} />Consume tabaco</span>
                  <YesNo
                    value={h.tob.on}
                    onChange={(v) => setH((prev) => ({ ...prev, tob: v === prev.tob.on ? { on: null, qty: '' } : { ...prev.tob, on: v } }))}
                  />
                  {h.tob.on === true && (
                    <div style={subStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          type="number" min={0} step={1} placeholder="—" aria-label="Cigarrillos por día"
                          value={h.tob.qty}
                          onChange={(e) => setH((prev) => ({ ...prev, tob: { ...prev.tob, qty: e.target.value } }))}
                          style={numInpStyle}
                        />
                        <span style={{ fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>cigarrillos por día aprox.</span>
                      </div>
                    </div>
                  )}
                </Fld>
              </div>
            </div>
          </section>

          <div style={{
            position: 'sticky', bottom: 0, margin: '20px -4px 0', padding: '12px 4px', background: 'color-mix(in oklab, var(--surface, #fff) 88%, transparent)',
            backdropFilter: 'blur(8px)', borderTop: '1px solid var(--border, #E7E9EE)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', zIndex: 20,
          }}>
            <div style={{ flex: 1, minWidth: 150, fontSize: 12.5, color: dirty ? 'var(--accent-ink, #1F4FD9)' : 'var(--muted-2, #8A93A1)', display: 'flex', alignItems: 'center', gap: 7 }}>
              {ICON_CLOCK}
              <span>{dirty ? 'Cambios sin guardar' : (h.updated ? `Guardado ${h.updated}` : 'Sin cambios')}</span>
            </div>
            {dirty && (
              <button type="button" onClick={handleDescartar} className="btn" style={{ padding: '9px 16px', fontSize: 13.5 }}>Descartar cambios</button>
            )}
            <button type="button" onClick={handleGuardar} disabled={guardando} className="btn primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13.5, opacity: guardando ? 0.7 : 1 }}>
              {ICON_CHECK}{guardando ? 'Guardando...' : 'Guardar relevamiento'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function SchedFoot({ h }: { h: HState }) {
  const nWeek = MEALS.filter(([k]) => h.week[k]).length
  const nWknd = MEALS.filter(([k]) => h.wknd[k]).length
  const nDesc = MEALS.filter(([k]) => (h.desc[k] ?? '').trim()).length
  if (nWeek + nWknd + nDesc === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--surface-3, #F1F3F6)', fontSize: 12, color: 'var(--muted-2, #8A93A1)' }}>
        Nada cargado todavía en el recordatorio de 24 horas.
      </div>
    )
  }
  const sep = <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-3, #AEB5C0)' }} />
  const b = (n: number) => <b style={{ color: 'var(--ink-2, #1F2937)', fontWeight: 600 }}>{n} de 6</b>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--surface-3, #F1F3F6)', fontSize: 12, color: 'var(--muted-2, #8A93A1)' }}>
      <span>Horarios de semana: {b(nWeek)}</span>{sep}<span>Fin de semana: {b(nWknd)}</span>{sep}<span>Descripciones: {b(nDesc)}</span>
    </div>
  )
}

function FilledDot({ on }: { on: boolean }) {
  return <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok, #10B981)', flexShrink: 0, opacity: on ? 1 : 0, display: 'inline-block' }} />
}

function Fld({ wide, filled, children }: { wide?: boolean; filled: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      gridColumn: wide ? '1 / -1' : undefined, padding: '13px 0', borderBottom: '1px solid var(--surface-3, #F1F3F6)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {children}
    </div>
  )
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', padding: 2, background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 8, gap: 2, flexShrink: 0, alignSelf: 'flex-start' }}>
      <button type="button" onClick={() => onChange(true)} style={{ border: 'none', background: value === true ? 'var(--ink, #0B1220)' : 'transparent', padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: value === true ? '#fff' : 'var(--muted, #5B6472)', borderRadius: 6, cursor: 'pointer' }}>Sí</button>
      <button type="button" onClick={() => onChange(false)} style={{ border: 'none', background: value === false ? 'var(--muted, #5B6472)' : 'transparent', padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: value === false ? '#fff' : 'var(--muted, #5B6472)', borderRadius: 6, cursor: 'pointer' }}>No</button>
    </div>
  )
}

const fldLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--ink-2, #1F2937)' }
const subStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 13, borderLeft: '2px solid var(--accent-soft, #EAF0FE)', marginTop: 2 }
const inpStyle: React.CSSProperties = { height: 38, border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)', padding: '0 11px', font: 'inherit', fontSize: 13.5, color: 'var(--ink, #0B1220)', background: 'var(--surface, #fff)', outline: 'none' }
const numInpStyle: React.CSSProperties = { ...inpStyle, width: 82, textAlign: 'right', paddingRight: 10, fontVariantNumeric: 'tabular-nums' }
const selectStyle: React.CSSProperties = { ...inpStyle, cursor: 'pointer' }
const timeInpStyle: React.CSSProperties = { width: '100%', height: 38, border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)', padding: '0 10px', font: 'inherit', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--ink, #0B1220)', background: 'var(--surface, #fff)', outline: 'none' }
const textareaStyle: React.CSSProperties = { width: '100%', display: 'block', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)', padding: '9px 11px', font: 'inherit', fontSize: 13, lineHeight: 1.55, color: 'var(--ink, #0B1220)', background: 'var(--surface-2, #F6F7F9)', outline: 'none', resize: 'vertical', minHeight: 62 }
