'use client'

import { useEffect, useRef, useState } from 'react'
import type { PlanComidaItem } from '@/types/database'
import { useVademecumAlimentos, type AlimentoVademecum } from '@/lib/hooks/useVademecumAlimentos'

export type ComidaConItems = {
  id: string
  plan_id: string
  dia_semana: string
  tipo_comida: string
  hora: string | null
  orden: number
  plan_comida_items: PlanComidaItem[]
}

interface Props {
  comida: ComidaConItems
  modo: 'formula' | 'simple'
  diasSemana: { value: string; label: string; tieneComidas: boolean }[]
  diaActual: string
  macrosPorAlimento: Map<string, AlimentoVademecum>
  onRegistrarAlimento: (a: AlimentoVademecum) => void
  onChanged: () => void
  readOnly?: boolean
}

const ICON = {
  clock: <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  copy: <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>,
  trash: <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>,
  x: <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none' }}><path d="M6 6l12 12M18 6l-12 12" /></svg>,
  plus: <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: 'currentColor', strokeWidth: 2, fill: 'none' }}><path d="M12 5v14M5 12h14" /></svg>,
  check: <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: '#fff', strokeWidth: 3, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>,
  chev: (open: boolean) => <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'currentColor', strokeWidth: 1.8, fill: 'none', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .16s ease' }}><path d="M6 9l6 6 6-6" /></svg>,
  mag: <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--muted-2, #8A93A1)', strokeWidth: 1.9, fill: 'none', position: 'absolute', left: 11, top: 11, pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
}

function round1(n: number): number { return Math.round(n * 10) / 10 }

function itemMacros(item: PlanComidaItem, alimento: AlimentoVademecum | undefined) {
  if (item.tipo !== 'alimento' || !alimento || item.cantidad_gramos == null) return null
  const r = item.cantidad_gramos / 100
  return {
    kcal: alimento.kcalPor100g == null ? null : round1(alimento.kcalPor100g * r),
    prot: alimento.proteinasPor100g == null ? null : round1(alimento.proteinasPor100g * r),
    gra: alimento.grasasPor100g == null ? null : round1(alimento.grasasPor100g * r),
    cho: alimento.carbohidratosPor100g == null ? null : round1(alimento.carbohidratosPor100g * r),
  }
}

function sumKcalComida(items: PlanComidaItem[], macrosPorAlimento: Map<string, AlimentoVademecum>) {
  let kcal = 0
  let foods = 0
  for (const item of items) {
    if (item.tipo !== 'alimento' || !item.alimento_id) continue
    const alimento = macrosPorAlimento.get(String(item.alimento_id))
    const v = itemMacros(item, alimento)
    if (v) {
      foods++
      if (v.kcal != null) kcal += v.kcal
    }
  }
  return { kcal, foods }
}

async function jsonOrNull(res: Response) {
  try { return await res.json() } catch { return null }
}

export default function PlanComidaBlock({
  comida, modo, diasSemana, diaActual, macrosPorAlimento, onRegistrarAlimento, onChanged, readOnly = false,
}: Props) {
  const [colapsado, setColapsado] = useState(false)
  const [nombre, setNombre] = useState(comida.tipo_comida)
  const [hora, setHora] = useState(comida.hora ?? '')
  const [popOpen, setPopOpen] = useState(false)
  const [diasSel, setDiasSel] = useState<Set<string>>(new Set())
  const [copiando, setCopiando] = useState(false)
  const [draftIds, setDraftIds] = useState<string[]>([])

  useEffect(() => { setNombre(comida.tipo_comida) }, [comida.tipo_comida])
  useEffect(() => { setHora(comida.hora ?? '') }, [comida.hora])

  const items = comida.plan_comida_items ?? []
  const { kcal, foods } = sumKcalComida(items, macrosPorAlimento)
  const resumen = modo === 'simple'
    ? `${items.length} ${items.length === 1 ? 'ítem' : 'ítems'}`
    : `${Math.round(kcal).toLocaleString('es-AR')} kcal · ${foods} ${foods === 1 ? 'alimento' : 'alimentos'}`

  async function commitNombre() {
    if (nombre === comida.tipo_comida) return
    await fetch(`/api/plan-comidas/${comida.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo_comida: nombre }),
    })
    onChanged()
  }

  async function commitHora() {
    if (hora === (comida.hora ?? '')) return
    await fetch(`/api/plan-comidas/${comida.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hora: hora || null }),
    })
    onChanged()
  }

  async function eliminarComida() {
    await fetch(`/api/plan-comidas/${comida.id}`, { method: 'DELETE' })
    onChanged()
  }

  async function agregarItemTexto() {
    await fetch(`/api/plan-comidas/${comida.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'texto_libre', contenido_texto: '' }),
    })
    onChanged()
  }

  // A diferencia de texto_libre, un ítem tipo=alimento sin alimento_id es un
  // registro incoherente (chk_item_coherente) — no se persiste nada hasta que
  // el profesional elija un alimento real. Mientras tanto es solo un borrador
  // en memoria (DraftAlimentoRow más abajo).
  function agregarBorradorAlimento() {
    setDraftIds((prev) => [...prev, `draft-${Date.now()}-${prev.length}`])
  }

  function quitarBorrador(draftId: string) {
    setDraftIds((prev) => prev.filter((id) => id !== draftId))
  }

  async function eliminarItem(itemId: string) {
    await fetch(`/api/plan-comida-items/${itemId}`, { method: 'DELETE' })
    onChanged()
  }

  function toggleDiaSel(dia: string) {
    setDiasSel((prev) => {
      const next = new Set(prev)
      if (next.has(dia)) next.delete(dia)
      else next.add(dia)
      return next
    })
  }

  async function copiarADias() {
    if (diasSel.size === 0) return
    setCopiando(true)
    try {
      for (const dia of Array.from(diasSel)) {
        const resComida = await fetch(`/api/planes-alimentarios/${comida.plan_id}/comidas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dia_semana: dia, tipo_comida: comida.tipo_comida, hora: comida.hora, orden: comida.orden }),
        })
        const data = await jsonOrNull(resComida)
        const nuevaComidaId = data?.comida?.id
        if (!nuevaComidaId) continue
        for (const item of items) {
          await fetch(`/api/plan-comidas/${nuevaComidaId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              item.tipo === 'alimento'
                ? { tipo: 'alimento', alimento_fuente: item.alimento_fuente, alimento_id: item.alimento_id, cantidad_gramos: item.cantidad_gramos }
                : { tipo: 'texto_libre', contenido_texto: item.contenido_texto }
            ),
          })
        }
      }
    } finally {
      setCopiando(false)
      setPopOpen(false)
      setDiasSel(new Set())
      onChanged()
    }
  }

  return (
    <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-lg, 12px)', boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(16,24,40,.04))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px 11px 14px' }}>
        <button type="button" onClick={() => setColapsado((c) => !c)} title="Contraer" style={ibtnStyle}>
          {ICON.chev(!colapsado)}
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={commitNombre}
            readOnly={readOnly}
            aria-label="Nombre de la comida"
            style={{ border: '1px solid transparent', background: 'transparent', borderRadius: 'var(--r-sm, 6px)', font: 'inherit', fontSize: 14.5, fontWeight: 600, color: readOnly ? 'var(--ink-2, #1F2937)' : 'var(--ink, #0B1220)', padding: '3px 6px', margin: '-3px -6px', minWidth: 60, outline: 'none', pointerEvents: readOnly ? 'none' : undefined }}
          />
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            onBlur={commitHora}
            readOnly={readOnly}
            aria-label="Horario"
            style={{ border: '1px solid transparent', background: 'transparent', borderRadius: 'var(--r-sm, 6px)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--muted, #5B6472)', padding: '3px 5px', width: 84, outline: 'none', pointerEvents: readOnly ? 'none' : undefined }}
          />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', whiteSpace: 'nowrap' }}>{resumen}</span>
        </div>
        {!readOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
          <button type="button" onClick={() => setPopOpen((o) => !o)} title="Copiar a otro día" style={ibtnStyle}>
            {ICON.copy}
          </button>
          {popOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 246, background: 'var(--surface, #fff)', border: '1px solid var(--border-strong, #D6DAE1)', borderRadius: 'var(--r-lg, 12px)', boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(16,24,40,.08))', zIndex: 30, padding: 12 }}>
              <h4 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: 'var(--ink, #0B1220)' }}>Copiar a otro día</h4>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', lineHeight: 1.5 }}>
                Se duplica «{comida.tipo_comida}» con sus {items.length} ítems.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 11 }}>
                {diasSemana.map((d) => {
                  const off = d.value === diaActual
                  const on = diasSel.has(d.value)
                  return (
                    <label key={d.value} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 6px', borderRadius: 'var(--r-sm, 6px)', cursor: off ? 'default' : 'pointer', fontSize: 13, color: 'var(--ink-2, #1F2937)', opacity: off ? 0.42 : 1 }}>
                      <span
                        onClick={() => !off && toggleDiaSel(d.value)}
                        style={{ width: 16, height: 16, borderRadius: 4, border: on ? 'none' : '1.5px solid var(--border-strong, #D6DAE1)', background: on ? 'var(--accent, #1F4FD9)' : 'var(--surface, #fff)', display: 'grid', placeItems: 'center', flexShrink: 0 }}
                      >
                        {on && ICON.check}
                      </span>
                      {d.label}
                      {off ? <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--muted-3, #AEB5C0)' }}>actual</span> : d.tieneComidas ? <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--muted-3, #AEB5C0)' }}>con comidas</span> : null}
                    </label>
                  )
                })}
              </div>
              <button type="button" onClick={copiarADias} disabled={diasSel.size === 0 || copiando} className="btn primary" style={{ width: '100%', justifyContent: 'center', opacity: (diasSel.size === 0 || copiando) ? 0.6 : 1 }}>
                {diasSel.size === 0 ? 'Copiar' : `Copiar a ${diasSel.size} ${diasSel.size === 1 ? 'día' : 'días'}`}
              </button>
            </div>
          )}
          <button type="button" onClick={eliminarComida} title="Eliminar comida" style={{ ...ibtnStyle, color: 'var(--muted, #5B6472)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-soft, #FEF2F2)'; e.currentTarget.style.color = 'var(--danger, #B42318)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted, #5B6472)' }}
          >
            {ICON.trash}
          </button>
        </div>
        )}
      </div>

      {!colapsado && (
        <div style={{ borderTop: '1px solid var(--border, #E7E9EE)', padding: '10px 12px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.length === 0 && draftIds.length === 0 && !readOnly && (
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>Sin ítems todavía.</p>
            )}
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                alimento={item.alimento_id ? macrosPorAlimento.get(String(item.alimento_id)) : undefined}
                onRegistrarAlimento={onRegistrarAlimento}
                onEliminar={() => eliminarItem(item.id)}
                onChanged={onChanged}
                readOnly={readOnly}
              />
            ))}
            {!readOnly && draftIds.map((draftId) => (
              <DraftAlimentoRow
                key={draftId}
                comidaId={comida.id}
                onRegistrarAlimento={onRegistrarAlimento}
                onCreado={() => { quitarBorrador(draftId); onChanged() }}
                onCancelar={() => quitarBorrador(draftId)}
              />
            ))}
          </div>
          {!readOnly && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {modo === 'formula' && (
              <button type="button" onClick={agregarBorradorAlimento} style={miniStyle}>{ICON.plus}Alimento</button>
            )}
            <button type="button" onClick={agregarItemTexto} style={miniStyle}>{ICON.plus}Texto libre</button>
          </div>
          )}
        </div>
      )}
    </div>
  )
}

const ibtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid transparent', background: 'transparent',
  display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, color: 'var(--muted, #5B6472)',
}

const miniStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 100,
  border: '1px dashed var(--border-strong, #D6DAE1)', background: 'transparent', fontSize: 12.5, fontWeight: 500,
  color: 'var(--muted, #5B6472)', cursor: 'pointer', fontFamily: 'inherit',
}

function ItemRow({
  item, alimento, onRegistrarAlimento, onEliminar, onChanged, readOnly = false,
}: {
  item: PlanComidaItem
  alimento: AlimentoVademecum | undefined
  onRegistrarAlimento: (a: AlimentoVademecum) => void
  onEliminar: () => void
  onChanged: () => void
  readOnly?: boolean
}) {
  const [textoLibre, setTextoLibre] = useState(item.contenido_texto ?? '')
  const [busquedaAlimento, setBusquedaAlimento] = useState(alimento?.nombre ?? '')
  const [cantidad, setCantidad] = useState(item.cantidad_gramos ?? 100)
  const [dropOpen, setDropOpen] = useState(false)
  const { resultados, buscando, buscar } = useVademecumAlimentos()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setTextoLibre(item.contenido_texto ?? '') }, [item.contenido_texto])
  useEffect(() => { setBusquedaAlimento(alimento?.nombre ?? '') }, [alimento?.nombre])
  useEffect(() => { setCantidad(item.cantidad_gramos ?? 100) }, [item.cantidad_gramos])

  useEffect(() => {
    if (!dropOpen) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [dropOpen])

  async function commitTexto() {
    if (textoLibre === (item.contenido_texto ?? '')) return
    await fetch(`/api/plan-comida-items/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'texto_libre', contenido_texto: textoLibre }),
    })
    onChanged()
  }

  async function commitCantidad(v: number) {
    if (v === item.cantidad_gramos) return
    await fetch(`/api/plan-comida-items/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'alimento', alimento_fuente: item.alimento_fuente ?? 'argenfood', alimento_id: item.alimento_id, cantidad_gramos: v }),
    })
    onChanged()
  }

  async function elegirAlimento(a: AlimentoVademecum) {
    setBusquedaAlimento(a.nombre)
    setDropOpen(false)
    onRegistrarAlimento(a)
    await fetch(`/api/plan-comida-items/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'alimento', alimento_fuente: a.fuente, alimento_id: a.id, cantidad_gramos: cantidad }),
    })
    onChanged()
  }

  if (item.tipo === 'texto_libre') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: readOnly ? 'minmax(0,1fr)' : 'minmax(0,1fr) 28px', gap: 8, alignItems: 'center' }}>
        <input
          value={textoLibre}
          onChange={(e) => setTextoLibre(e.target.value)}
          onBlur={commitTexto}
          readOnly={readOnly}
          placeholder="Ej.: 1 taza de arroz integral con verduras"
          aria-label="Texto libre"
          style={{ ...inpStyle, ...(readOnly ? { pointerEvents: 'none', borderColor: 'transparent', background: 'transparent', color: 'var(--ink-2, #1F2937)' } : {}) }}
        />
        {!readOnly && <button type="button" onClick={onEliminar} title="Quitar" style={{ ...ibtnStyle, color: 'var(--danger, #B42318)' }}>{ICON.x}</button>}
      </div>
    )
  }

  const v = itemMacros(item, alimento)
  const cell = (val: number | null, unit: string) => val == null
    ? <span style={{ color: 'var(--muted-3, #AEB5C0)' }}>s/d</span>
    : <><b style={{ color: 'var(--ink-2, #1F2937)', fontWeight: 500 }}>{Math.round(val)}</b>{unit}</>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: readOnly ? 'minmax(0,1fr) 84px auto' : 'minmax(0,1fr) 84px auto 28px', gap: 8, alignItems: 'center' }}>
      <div ref={wrapRef} style={{ position: 'relative' }}>
        {ICON.mag}
        <input
          value={busquedaAlimento}
          onChange={(e) => { setBusquedaAlimento(e.target.value); setDropOpen(true); buscar(e.target.value) }}
          onFocus={() => { setDropOpen(true); buscar(busquedaAlimento) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && resultados.length > 0) { e.preventDefault(); elegirAlimento(resultados[0]) } }}
          readOnly={readOnly}
          placeholder="Buscar alimento…"
          autoComplete="off"
          aria-label="Alimento"
          style={{ ...inpStyle, paddingLeft: 32, ...(readOnly ? { pointerEvents: 'none', borderColor: 'transparent', background: 'transparent', color: 'var(--ink-2, #1F2937)' } : {}) }}
        />
        {!readOnly && dropOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, minWidth: 300, background: 'var(--surface, #fff)', border: '1px solid var(--border-strong, #D6DAE1)', borderRadius: 'var(--r-md, 8px)', boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(16,24,40,.08))', zIndex: 25, maxHeight: 268, overflow: 'auto', padding: 4 }}>
            {buscando && (
              <div style={{ padding: '12px 10px', fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>Buscando…</div>
            )}
            {!buscando && resultados.length === 0 && (
              <div style={{ padding: '12px 10px', fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>
                Sin resultados{busquedaAlimento ? ` para «${busquedaAlimento}»` : ''}. Podés cargarlo como texto libre.
              </div>
            )}
            {!buscando && (() => {
              const hayTermino = busquedaAlimento.trim() !== ''
              let ultimoGrupo: string | null = null
              return resultados.map((a) => {
                const mostrarHeader = !hayTermino && a.grupo !== ultimoGrupo
                if (mostrarHeader) ultimoGrupo = a.grupo
                return (
                  <div key={a.id}>
                    {mostrarHeader && (
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-3, #AEB5C0)', padding: '8px 9px 3px' }}>
                        {a.grupo}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); elegirAlimento(a) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', textAlign: 'left', font: 'inherit', padding: '7px 9px', borderRadius: 'var(--r-sm, 6px)', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #F6F7F9)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink, #0B1220)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</span>
                      {hayTermino && (
                        <span style={{ fontSize: 11, color: 'var(--muted-2, #8A93A1)', flexShrink: 0 }}>{a.grupo}</span>
                      )}
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--muted-3, #AEB5C0)', flexShrink: 0 }}>
                        {a.kcalPor100g != null ? `${Math.round(a.kcalPor100g)} kcal/100g` : 's/d'}
                      </span>
                    </button>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="number" min={0} step={5}
          value={cantidad}
          onChange={(e) => setCantidad(Math.max(0, Number(e.target.value) || 0))}
          onBlur={() => commitCantidad(cantidad)}
          readOnly={readOnly}
          aria-label="Cantidad en gramos"
          style={{ ...inpStyle, paddingRight: 26, textAlign: 'right', ...(readOnly ? { pointerEvents: 'none', borderColor: 'transparent', background: 'transparent', color: 'var(--ink-2, #1F2937)' } : {}) }}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', pointerEvents: 'none' }}>g</span>
      </div>
      {v ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--muted, #5B6472)', whiteSpace: 'nowrap' }}>
          {v.kcal == null ? <span style={{ color: 'var(--muted-3, #AEB5C0)' }}>s/d kcal</span> : <span style={{ color: 'var(--ink, #0B1220)', fontWeight: 500 }}>{Math.round(v.kcal)} kcal</span>}
          <span>P {cell(v.prot, 'g')}</span>
          <span>G {cell(v.gra, 'g')}</span>
          <span>HC {cell(v.cho, 'g')}</span>
        </div>
      ) : (
        <div style={{ color: 'var(--muted-3, #AEB5C0)', fontSize: 11.5, whiteSpace: 'nowrap' }}>Elegí un alimento para calcular</div>
      )}
      {!readOnly && <button type="button" onClick={onEliminar} title="Quitar" style={{ ...ibtnStyle, color: 'var(--danger, #B42318)' }}>{ICON.x}</button>}
    </div>
  )
}

const inpStyle: React.CSSProperties = {
  width: '100%', height: 36, border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-md, 8px)',
  padding: '0 11px', font: 'inherit', fontSize: 13.5, color: 'var(--ink, #0B1220)', background: 'var(--surface, #fff)', outline: 'none',
}

// Fila "borrador" para un ítem tipo=alimento todavía sin elegir — no existe
// como fila en la base (sería incoherente: alimento sin alimento_id). Recién
// se persiste (POST real) cuando el profesional elige un alimento concreto.
function DraftAlimentoRow({
  comidaId, onRegistrarAlimento, onCreado, onCancelar,
}: {
  comidaId: string
  onRegistrarAlimento: (a: AlimentoVademecum) => void
  onCreado: () => void
  onCancelar: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [cantidad, setCantidad] = useState(100)
  const [dropOpen, setDropOpen] = useState(true)
  const [creando, setCreando] = useState(false)
  const { resultados, buscando, buscar } = useVademecumAlimentos()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    buscar('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!dropOpen) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onCancelar()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [dropOpen, onCancelar])

  async function elegir(a: AlimentoVademecum) {
    setDropOpen(false)
    setCreando(true)
    onRegistrarAlimento(a)
    await fetch(`/api/plan-comidas/${comidaId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'alimento', alimento_fuente: a.fuente, alimento_id: a.id, cantidad_gramos: cantidad }),
    })
    onCreado()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 84px auto 28px', gap: 8, alignItems: 'center' }}>
      <div ref={wrapRef} style={{ position: 'relative' }}>
        {ICON.mag}
        <input
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setDropOpen(true); buscar(e.target.value) }}
          onFocus={() => setDropOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' && resultados.length > 0) { e.preventDefault(); elegir(resultados[0]) } }}
          placeholder="Buscar alimento…"
          autoComplete="off"
          aria-label="Alimento"
          disabled={creando}
          autoFocus
          style={{ ...inpStyle, paddingLeft: 32 }}
        />
        {dropOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, minWidth: 300, background: 'var(--surface, #fff)', border: '1px solid var(--border-strong, #D6DAE1)', borderRadius: 'var(--r-md, 8px)', boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(16,24,40,.08))', zIndex: 25, maxHeight: 268, overflow: 'auto', padding: 4 }}>
            {buscando && (
              <div style={{ padding: '12px 10px', fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>Buscando…</div>
            )}
            {!buscando && resultados.length === 0 && (
              <div style={{ padding: '12px 10px', fontSize: 12.5, color: 'var(--muted-2, #8A93A1)' }}>
                Sin resultados{busqueda ? ` para «${busqueda}»` : ''}. Podés cargarlo como texto libre.
              </div>
            )}
            {!buscando && (() => {
              const hayTermino = busqueda.trim() !== ''
              let ultimoGrupo: string | null = null
              return resultados.map((a) => {
                const mostrarHeader = !hayTermino && a.grupo !== ultimoGrupo
                if (mostrarHeader) ultimoGrupo = a.grupo
                return (
                  <div key={a.id}>
                    {mostrarHeader && (
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted-3, #AEB5C0)', padding: '8px 9px 3px' }}>
                        {a.grupo}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); elegir(a) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', textAlign: 'left', font: 'inherit', padding: '7px 9px', borderRadius: 'var(--r-sm, 6px)', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2, #F6F7F9)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink, #0B1220)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</span>
                      {hayTermino && (
                        <span style={{ fontSize: 11, color: 'var(--muted-2, #8A93A1)', flexShrink: 0 }}>{a.grupo}</span>
                      )}
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: 'var(--muted-3, #AEB5C0)', flexShrink: 0 }}>
                        {a.kcalPor100g != null ? `${Math.round(a.kcalPor100g)} kcal/100g` : 's/d'}
                      </span>
                    </button>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="number" min={0} step={5}
          value={cantidad}
          onChange={(e) => setCantidad(Math.max(0, Number(e.target.value) || 0))}
          disabled={creando}
          aria-label="Cantidad en gramos"
          style={{ ...inpStyle, paddingRight: 26, textAlign: 'right' }}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11.5, color: 'var(--muted-2, #8A93A1)', pointerEvents: 'none' }}>g</span>
      </div>
      <div style={{ color: 'var(--muted-3, #AEB5C0)', fontSize: 11.5, whiteSpace: 'nowrap' }}>Elegí un alimento para calcular</div>
      <button type="button" onClick={onCancelar} title="Cancelar" style={{ ...ibtnStyle, color: 'var(--danger, #B42318)' }}>{ICON.x}</button>
    </div>
  )
}
