'use client'

import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { RegistroRefraccion } from '@/types/database'
import { recetaCompleta as recetaCompletaUtil, formatearDioptrias } from '@/lib/oftalmologia/refraccion'
import './rx-grid.css'

type Variant = 'standalone' | 'embebida'
type Eye = 'od' | 'oi'
type FieldKey = 'sph' | 'cyl' | 'axis' | 'add' | 'av'
type FieldType = 'signed' | 'int' | 'text'

const FIELDS: { key: FieldKey; label: string; type: FieldType }[] = [
  { key: 'sph', label: 'SPH', type: 'signed' },
  { key: 'cyl', label: 'CYL', type: 'signed' },
  { key: 'axis', label: 'AXIS', type: 'int' },
  { key: 'add', label: 'ADD', type: 'signed' },
  { key: 'av', label: 'AV', type: 'text' },
]

type Draft = {
  id: string | null
  created_at: string
  sph_od: number | null; cyl_od: number | null; axis_od: number | null; add_od: number | null; av_od: string | null
  sph_oi: number | null; cyl_oi: number | null; axis_oi: number | null; add_oi: number | null; av_oi: string | null
}

const EMPTY_DRAFT: Omit<Draft, 'id' | 'created_at'> = {
  sph_od: null, cyl_od: null, axis_od: null, add_od: null, av_od: null,
  sph_oi: null, cyl_oi: null, axis_oi: null, add_oi: null, av_oi: null,
}

function toDraft(r: RegistroRefraccion): Draft {
  return { id: r.id, created_at: r.created_at, sph_od: r.sph_od, cyl_od: r.cyl_od, axis_od: r.axis_od, add_od: r.add_od, av_od: r.av_od, sph_oi: r.sph_oi, cyl_oi: r.cyl_oi, axis_oi: r.axis_oi, add_oi: r.add_oi, av_oi: r.av_oi }
}

function getVal(d: Draft, eye: Eye, key: FieldKey): number | string | null {
  return (d as unknown as Record<string, number | string | null>)[`${key}_${eye}`]
}

function fmtValue(type: FieldType, value: number | string | null): { text: string; empty: boolean } {
  if (value === null || value === undefined || value === '') return { text: '—', empty: true }
  if (type === 'signed') return { text: formatearDioptrias(Number(value)), empty: false }
  if (type === 'int') return { text: `${value}°`, empty: false }
  return { text: String(value), empty: false }
}

function fmtFecha(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy', { locale: es })
}

interface Props {
  pacienteId: string
  variant?: Variant
}

export default function RxGrid({ pacienteId, variant = 'standalone' }: Props) {
  const [recetas, setRecetas] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [histOpen, setHistOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(variant === 'embebida')
  const [editingCell, setEditingCell] = useState<{ eye: Eye; key: FieldKey } | null>(null)
  const [editValue, setEditValue] = useState('')
  const histRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/refraccion/listar?pacienteId=${pacienteId}`)
      .then((res) => res.json())
      .then((data) => setRecetas((data.recetas ?? []).map(toDraft)))
      .finally(() => setLoading(false))
  }, [pacienteId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (histRef.current && !histRef.current.contains(e.target as Node)) setHistOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  function handleNuevaReceta() {
    const draft: Draft = { id: null, created_at: new Date().toISOString(), ...EMPTY_DRAFT }
    setRecetas((prev) => [draft, ...prev])
    setSelectedIdx(0)
  }

  async function commitField(eye: Eye, key: FieldKey, rawValue: string) {
    const top = recetas[0]
    const type = FIELDS.find((f) => f.key === key)!.type
    let parsed: number | string | null
    if (rawValue.trim() === '') parsed = null
    else if (type === 'signed' || type === 'int') parsed = Number(rawValue)
    else parsed = rawValue.trim()

    const merged: Omit<Draft, 'id' | 'created_at'> = {
      sph_od: top.sph_od, cyl_od: top.cyl_od, axis_od: top.axis_od, add_od: top.add_od, av_od: top.av_od,
      sph_oi: top.sph_oi, cyl_oi: top.cyl_oi, axis_oi: top.axis_oi, add_oi: top.add_oi, av_oi: top.av_oi,
    }
    ;(merged as unknown as Record<string, number | string | null>)[`${key}_${eye}`] = parsed

    const res = await fetch('/api/refraccion/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pacienteId,
        sphOd: merged.sph_od, cylOd: merged.cyl_od, axisOd: merged.axis_od, addOd: merged.add_od, avOd: merged.av_od,
        sphOi: merged.sph_oi, cylOi: merged.cyl_oi, axisOi: merged.axis_oi, addOi: merged.add_oi, avOi: merged.av_oi,
      }),
    })
    if (!res.ok) return
    const { receta } = await res.json()
    const nuevo = toDraft(receta)

    setRecetas((prev) => {
      if (top.id === null) {
        return [nuevo, ...prev.slice(1)]
      }
      return [nuevo, ...prev]
    })
  }

  function startEdit(eye: Eye, key: FieldKey, current: number | string | null) {
    setEditingCell({ eye, key })
    setEditValue(current === null || current === undefined ? '' : String(current))
  }

  async function handleCommit() {
    if (!editingCell) return
    const { eye, key } = editingCell
    setEditingCell(null)
    await commitField(eye, key, editValue)
  }

  const receta = recetas[selectedIdx] ?? null
  const editable = selectedIdx === 0
  const completa = receta ? recetaCompletaUtil({
    sph_od: receta.sph_od, cyl_od: receta.cyl_od, axis_od: receta.axis_od, add_od: receta.add_od, av_od: receta.av_od,
    sph_oi: receta.sph_oi, cyl_oi: receta.cyl_oi, axis_oi: receta.axis_oi, add_oi: receta.add_oi, av_oi: receta.av_oi,
  }) : false

  function renderCell(eye: Eye, key: FieldKey, type: FieldType, extraClass: 'rx-cell' | 'rx-mfield') {
    if (!receta) return null
    const value = getVal(receta, eye, key)
    const isEditing = editable && editingCell?.eye === eye && editingCell?.key === key
    const { text, empty } = fmtValue(type, value)

    if (extraClass === 'rx-mfield') {
      return (
        <div
          key={key}
          className={`rx-mfield ${editable ? 'editable' : ''}`}
          onClick={() => editable && !isEditing && startEdit(eye, key, value)}
        >
          <span className="lbl">{FIELDS.find((f) => f.key === key)!.label}</span>
          {isEditing ? (
            <input
              autoFocus
              type={type === 'text' ? 'text' : 'number'}
              step={type === 'signed' ? 0.25 : undefined}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setEditingCell(null)
              }}
            />
          ) : (
            <span className={`val ${empty ? 'empty' : ''}`}>{text}</span>
          )}
        </div>
      )
    }

    return (
      <div
        key={key}
        className={`rx-cell ${editable ? 'editable' : 'readonly'} ${empty ? 'empty' : ''}`}
        onClick={() => editable && !isEditing && startEdit(eye, key, value)}
      >
        {isEditing ? (
          <input
            autoFocus
            type={type === 'text' ? 'text' : 'number'}
            step={type === 'signed' ? 0.25 : undefined}
            min={type === 'int' ? 0 : undefined}
            max={type === 'int' ? 180 : undefined}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditingCell(null)
            }}
          />
        ) : text}
      </div>
    )
  }

  const cuerpo = loading ? (
    <p style={{ fontSize: 13, color: 'var(--muted-2)' }}>Cargando...</p>
  ) : recetas.length === 0 ? (
    <div className="rx-empty">
      <span className="ttl">Todavía no hay recetas de refracción</span>
      <p>Cargá la primera receta para empezar a registrar la agudeza visual y los valores de esfera, cilindro y eje de este paciente.</p>
      <button className="rx-newbtn" onClick={handleNuevaReceta}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
        Cargar primera receta
      </button>
    </div>
  ) : (
    <>
      {!editable && (
        <div className="rx-readonly-note">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
          Registro histórico — no editable. Para modificar valores, cargá una nueva receta.
        </div>
      )}
      <div className="rx-card">
        <div className="rx-grid-wrap">
          <div className="rx-grid">
            <div />
            {FIELDS.map((f) => <div key={f.key} className="rx-col-hdr">{f.label}</div>)}
            <div className="rx-eye-label">OD</div>
            {FIELDS.map((f) => renderCell('od', f.key, f.type, 'rx-cell'))}
            <div className="rx-divider" />
            <div className="rx-eye-label">OI</div>
            {FIELDS.map((f) => renderCell('oi', f.key, f.type, 'rx-cell'))}
          </div>
        </div>

        <div className="rx-mobile-wrap" style={{ display: 'none' }}>
          {(['od', 'oi'] as Eye[]).map((eye) => (
            <div key={eye} className="rx-eye-card">
              <div className="rx-eye-hdr">{eye.toUpperCase()}</div>
              <div className="rx-mfield-grid">
                {FIELDS.map((f) => renderCell(eye, f.key, f.type, 'rx-mfield'))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )

  const header = recetas.length > 0 && (
    <div className="rx-hist" ref={histRef}>
      <button className="rx-hist-btn" onClick={() => setHistOpen((v) => !v)}>
        <span>{fmtFecha(receta!.created_at)}{selectedIdx === 0 ? ' · Actual' : ''}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
      </button>
      {histOpen && (
        <div className="rx-hist-menu">
          {recetas.map((r, i) => {
            const rCompleta = recetaCompletaUtil({
              sph_od: r.sph_od, cyl_od: r.cyl_od, axis_od: r.axis_od, add_od: r.add_od, av_od: r.av_od,
              sph_oi: r.sph_oi, cyl_oi: r.cyl_oi, axis_oi: r.axis_oi, add_oi: r.add_oi, av_oi: r.av_oi,
            })
            return (
              <button
                key={r.id ?? 'draft'}
                className={`rx-hist-item ${i === selectedIdx ? 'active' : ''}`}
                onClick={() => { setSelectedIdx(i); setHistOpen(false) }}
              >
                <div className="d">
                  <div className="date">{fmtFecha(r.created_at)}{i === 0 ? ' · Actual' : ''}</div>
                </div>
                <span className={`rx-chip ${rCompleta ? 'ok' : 'warn'}`}>{rCompleta ? 'Completa' : 'Incompleta'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  if (variant === 'embebida') {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="rx-embed-hdr" onClick={() => setCollapsed((v) => !v)}>
          <span>Refracción</span>
          <svg viewBox="0 0 24 24" style={{ transform: collapsed ? 'none' : 'rotate(180deg)' }}><path d="M6 9l6 6 6-6" stroke="currentColor" fill="none" strokeWidth={2} /></svg>
        </div>
        {!collapsed && (
          <div className="rx-embed-body" style={{ maxWidth: 520 }}>
            {recetas.length > 0 && <div style={{ marginBottom: 12 }}>{header}</div>}
            {cuerpo}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rx-standalone">
      <div className="rx-tabhdr">
        <div>
          <h2>Refracción</h2>
          <div className="sub">
            {loading ? '—' : recetas.length === 0 ? 'Sin recetas cargadas' : `${recetas.length} receta${recetas.length === 1 ? '' : 's'} cargada${recetas.length === 1 ? '' : 's'} · viendo ${fmtFecha(receta!.created_at)}${editable ? ' (editable)' : ' (histórico)'}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {header}
          {recetas.length > 0 && (
            <button className="rx-newbtn" onClick={handleNuevaReceta}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              Nueva receta
            </button>
          )}
        </div>
      </div>
      {cuerpo}
    </div>
  )
}
