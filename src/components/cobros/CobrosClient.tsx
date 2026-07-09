'use client'

import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import RegistrarPagoSlide from './RegistrarPagoSlide'
import DetallePacienteSlide from './DetallePacienteSlide'

export type TurnoDeuda = {
  id: string
  fecha_hora: string
  duracion_min: number
  monto: number
  moneda: string
  estado: string
  estado_pago: 'pendiente' | 'pago_parcial' | 'bonificado'
  monto_pagado: number
  paciente_id: string
  paciente_nombre: string
  paciente_apellido: string
  os_config_id: string | null
  os_nombre: string | null
}

export type TopDeudor = {
  paciente_id: string
  nombre: string
  apellido: string
  os_nombre: string | null
  saldo: number
  moneda: string
}

interface SummaryStats {
  particAdeudado: number
  particMesActual: number
  osAdeudado: number
  osMesActual: number
  particAdeudadoCount: number
  osAdeudadoCount: number
}

interface CobrosClientProps {
  turnos: TurnoDeuda[]
  top3: TopDeudor[]
  summary: SummaryStats
  terapeutaId: string
  moneda: string
}

type TabFilter = 'all' | 'partic' | 'os'
type DateFilter = 'mes_actual' | 'mes_anterior' | 'semestre' | 'anio' | 'historico'

const AVATAR_VARIANTS = [
  { bg: 'linear-gradient(145deg, #E3E9F6, #C9D3E9)', color: '#16389F' },
  { bg: 'linear-gradient(145deg, #F4E4E0, #E5C9C0)', color: '#8A3520' },
  { bg: 'linear-gradient(145deg, #E4F0E4, #C0DBC0)', color: '#205A2E' },
  { bg: 'linear-gradient(145deg, #F2E8F4, #DCC0E0)', color: '#5B3DC9' },
  { bg: 'linear-gradient(145deg, #F4EEDC, #E0D2A6)', color: '#7A5A0F' },
]

function getAvatarStyle(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return AVATAR_VARIANTS[hash % AVATAR_VARIANTS.length]
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function getCurrencySymbol(moneda: string) {
  if (moneda === 'USD') return 'US$'
  if (moneda === 'EUR') return '€'
  return '$'
}

function getArgNow() {
  return new Date(new Date().getTime() - 3 * 60 * 60 * 1000)
}

function getMesBoundaries(year: number, month: number) {
  return {
    inicio: new Date(Date.UTC(year, month, 1, 3, 0, 0)),
    fin: new Date(Date.UTC(year, month + 1, 1, 3, 0, 0)),
  }
}

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#8A93A1',
  textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 16px',
  borderBottom: '1px solid #E7E9EE', background: '#F6F7F9', whiteSpace: 'nowrap',
}
const TD: React.CSSProperties = { padding: '14px 16px', fontSize: '13.5px', verticalAlign: 'middle' }

function SumCardMulti({ type, label, values, meta }: { type: 'histo' | 'month'; label: string; values: Record<string, number>; meta: string }) {
  const dotColor = type === 'histo' ? '#001a48' : '#f59e0b'
  const entries = Object.entries(values).filter(([, v]) => v > 0)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: type === 'histo' ? 'linear-gradient(90deg, #001a48, var(--accent))' : 'linear-gradient(90deg, #f59e0b, #FB923C)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        {label}
      </div>
      {entries.length === 0 ? (
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--muted-2)' }}>—</div>
      ) : entries.map(([m, v]) => (
        <div key={m} style={{ fontSize: entries.length > 1 ? '18px' : '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, marginRight: '4px' }}>{getCurrencySymbol(m)}</span>
          {fmtNum(v)}
          {entries.length > 1 && <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>{m}</span>}
        </div>
      ))}
      {meta && <div style={{ marginTop: '6px', fontSize: '11.5px', color: 'var(--muted)' }}>{meta}</div>}
    </div>
  )
}

function StatusChip({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pendiente:   { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Pendiente' },
    pago_parcial:{ bg: 'var(--warn-soft)',   color: 'var(--warn)',   label: 'Pago parcial' },
    bonificado:  { bg: 'var(--surface-2)',   color: 'var(--muted)',  label: 'Bonificado' },
    pagado:      { bg: 'var(--ok-soft)',     color: 'var(--ok)',     label: 'Pagado' },
  }
  const s = map[estado] ?? map.pendiente
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 9px', borderRadius: '100px', fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap', background: s.bg, color: s.color }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function MenuBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '7px 9px', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', textAlign: 'left', color: danger ? '#DC2626' : '#1F2937', background: hov ? (danger ? '#FEE2E2' : '#F6F7F9') : 'transparent' }}
    >
      {children}
    </button>
  )
}

export default function CobrosClient({ turnos, top3, summary, terapeutaId, moneda }: CobrosClientProps) {
  const router = useRouter()
  const argNow = getArgNow()
  const mesArg = argNow.getUTCMonth()
  const anioArg = argNow.getUTCFullYear()

  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('mes_actual')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(['pendiente', 'pago_parcial']))
  const [pagoSlide, setPagoSlide] = useState<{ turno: TurnoDeuda } | null>(null)
  const [detalleSlide, setDetalleSlide] = useState<{ paciente_id: string; nombre: string; apellido: string; os_nombre: string | null } | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)

  function toggleExpand(pid: string) {
    setExpandedPatients(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n })
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    if (openMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  const dateBoundaries = useMemo(() => {
    const hoy = getArgNow()
    const m = hoy.getUTCMonth()
    const y = hoy.getUTCFullYear()
    if (dateFilter === 'mes_actual') return getMesBoundaries(y, m)
    if (dateFilter === 'mes_anterior') {
      const pm = m === 0 ? 11 : m - 1; const py = m === 0 ? y - 1 : y
      return getMesBoundaries(py, pm)
    }
    if (dateFilter === 'semestre') {
      const i6 = new Date(Date.UTC(m >= 6 ? y : y - 1, m >= 6 ? m - 6 : m + 6, 1, 3, 0, 0))
      return { inicio: i6, fin: new Date(Date.UTC(y, m + 1, 1, 3, 0, 0)) }
    }
    if (dateFilter === 'anio') return { inicio: new Date(Date.UTC(y, 0, 1, 3, 0, 0)), fin: new Date(Date.UTC(y + 1, 0, 1, 3, 0, 0)) }
    return null
  }, [dateFilter])

  const filtered = useMemo(() => turnos.filter(t => {
    if (tabFilter === 'partic' && t.os_config_id) return false
    if (tabFilter === 'os' && !t.os_config_id) return false
    if (!statusFilter.has(t.estado_pago)) return false
    if (dateBoundaries) {
      const dt = new Date(t.fecha_hora)
      if (dt < dateBoundaries.inicio || dt >= dateBoundaries.fin) return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      if (!`${t.paciente_nombre} ${t.paciente_apellido}`.toLowerCase().includes(q)) return false
    }
    return true
  }), [turnos, tabFilter, statusFilter, dateBoundaries, searchQuery])

  const countAll = useMemo(() => turnos.filter(t => statusFilter.has(t.estado_pago)).length, [turnos, statusFilter])
  const countPartic = useMemo(() => turnos.filter(t => !t.os_config_id && statusFilter.has(t.estado_pago)).length, [turnos, statusFilter])
  const countOS = useMemo(() => turnos.filter(t => !!t.os_config_id && statusFilter.has(t.estado_pago)).length, [turnos, statusFilter])

  const patientGroups = useMemo(() => {
    type Group = {
      paciente_id: string; nombre: string; apellido: string
      os_config_id: string | null; os_nombre: string | null
      sessions: TurnoDeuda[]
      saldoPorMoneda: Record<string, number>
    }
    const map = new Map<string, Group>()
    for (const t of filtered) {
      if (!map.has(t.paciente_id)) {
        map.set(t.paciente_id, { paciente_id: t.paciente_id, nombre: t.paciente_nombre, apellido: t.paciente_apellido, os_config_id: t.os_config_id, os_nombre: t.os_nombre, sessions: [], saldoPorMoneda: {} })
      }
      const g = map.get(t.paciente_id)!
      g.sessions.push(t)
      const saldo = Math.max(0, (t.monto ?? 0) - (t.monto_pagado ?? 0))
      const m = t.moneda ?? 'ARS'
      g.saldoPorMoneda[m] = (g.saldoPorMoneda[m] ?? 0) + saldo
    }
    return Array.from(map.values())
  }, [filtered])

  const currencyBreakdown = useMemo(() => {
    const histoPartic: Record<string, number> = {}
    const histoOS: Record<string, number> = {}
    const mesPartic: Record<string, number> = {}
    const mesOS: Record<string, number> = {}
    const ahora = getArgNow()
    const curMes = ahora.getUTCMonth()
    const curAnio = ahora.getUTCFullYear()
    const inicioMes = new Date(Date.UTC(curAnio, curMes, 1, 3, 0, 0))
    const finMes = new Date(Date.UTC(curAnio, curMes + 1, 1, 3, 0, 0))
    for (const t of turnos) {
      if (t.estado_pago === 'bonificado') continue
      const saldo = Math.max(0, t.monto - t.monto_pagado)
      if (saldo <= 0) continue
      const m = t.moneda ?? 'ARS'
      const dt = new Date(t.fecha_hora)
      const enMes = dt >= inicioMes && dt < finMes
      if (!t.os_config_id) {
        histoPartic[m] = (histoPartic[m] ?? 0) + saldo
        if (enMes) mesPartic[m] = (mesPartic[m] ?? 0) + saldo
      } else {
        histoOS[m] = (histoOS[m] ?? 0) + saldo
        if (enMes) mesOS[m] = (mesOS[m] ?? 0) + saldo
      }
    }
    return { histoPartic, histoOS, mesPartic, mesOS }
  }, [turnos])

  function toggleStatus(s: string) {
    setStatusFilter(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })
  }

  async function handleBonificar(turnoId: string) {
    setOpenMenu(null)
    const res = await fetch('/api/cobros/bonificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turno_id: turnoId }) })
    if (res.ok) router.refresh()
    else alert((await res.json()).error || 'Error al bonificar')
  }

  async function handleEliminar(turnoId: string) {
    const res = await fetch('/api/cobros/eliminar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turno_id: turnoId }) })
    if (res.ok) router.refresh()
    else alert((await res.json()).error || 'Error al eliminar')
    setConfirmDelete(null)
  }

  function openDetalle(t: TurnoDeuda) {
    setDetalleSlide({ paciente_id: t.paciente_id, nombre: t.paciente_nombre, apellido: t.paciente_apellido, os_nombre: t.os_nombre })
  }

  function handleExportar() {
    const sym = getCurrencySymbol(moneda)
    const rows = [
      ['Paciente', 'Sesión', 'Cobertura', 'Monto', 'Cobrado', 'Saldo', 'Estado'],
      ...filtered.map(t => {
        const dt = new Date(new Date(t.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
        const fecha = dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        const saldo = Math.max(0, (t.monto ?? 0) - (t.monto_pagado ?? 0))
        return [
          `${t.paciente_nombre} ${t.paciente_apellido}`,
          fecha,
          t.os_nombre ?? 'Particular',
          `${sym}${fmtNum(t.monto)}`,
          t.monto_pagado > 0 ? `${sym}${fmtNum(t.monto_pagado)}` : '—',
          saldo > 0 ? `${sym}${fmtNum(saldo)}` : '—',
          t.estado_pago,
        ]
      }),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cobros-${MESES_CORTO[mesArg]}-${anioArg}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Sticky top bar — desktop only */}
      <div className="hidden md:flex" style={{ position: 'sticky', top: 0, zIndex: 40, background: 'color-mix(in oklab, var(--bg) 85%, transparent)', backdropFilter: 'saturate(140%) blur(8px)', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: '14px', padding: '10px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', flexShrink: 0 }}>
          <span style={{ color: 'var(--muted)', fontWeight: 450 }}>KLIA</span>
          <span style={{ color: 'var(--muted-3)' }}>/</span>
          <span style={{ color: 'var(--muted)', fontWeight: 450 }}>Cobros</span>
          <span style={{ color: 'var(--muted-3)' }}>/</span>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{MESES_LARGO[mesArg]} {anioArg}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', padding: '0 10px', borderRadius: '7px', width: '280px', height: '30px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="1.8" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Buscar paciente, sesión..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', color: 'var(--ink)', minWidth: 0 }}
          />
          <kbd style={{ fontSize: '10.5px', color: 'var(--muted-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>⌘K</kbd>
        </div>
        <button style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.7"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>
      </div>

    <div style={{ maxWidth: '1320px', width: '100%', margin: '0 auto', padding: '0 32px 80px' }}>

      {/* Page header */}
      <header style={{ padding: '22px 0 6px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15, color: '#0B1220' }}>Cobros</h1>
          <p style={{ color: '#5B6472', fontSize: '14px', margin: '4px 0 0' }}>Gestioná pagos pendientes de particulares y obras sociales.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={handleExportar}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #E7E9EE', background: '#FFFFFF', fontSize: '13px', fontWeight: 500, color: '#1F2937', cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>
        </div>
      </header>

      {/* Summary groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginTop: '22px' }}>
        {/* Particulares */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
            </span>
            Particulares y co-pagos
          </div>
          <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: '12px' }}>
            <SumCardMulti type="histo" label="Adeudado histórico" values={currencyBreakdown.histoPartic} meta={`${summary.particAdeudadoCount} sesión${summary.particAdeudadoCount !== 1 ? 'es' : ''} pendiente${summary.particAdeudadoCount !== 1 ? 's' : ''}`} />
            <SumCardMulti type="month" label="Mes en curso" values={currencyBreakdown.mesPartic} meta="" />
          </div>
        </div>
        {/* Obras Sociales */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"/></svg>
            </span>
            Obras sociales
          </div>
          <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: '12px' }}>
            <SumCardMulti type="histo" label="Adeudado histórico" values={currencyBreakdown.histoOS} meta={`${summary.osAdeudadoCount} sesión${summary.osAdeudadoCount !== 1 ? 'es' : ''}`} />
            <SumCardMulti type="month" label="Mes en curso" values={currencyBreakdown.mesOS} meta="" />
          </div>
        </div>
      </div>

      {/* Top 3 deudores */}
      {top3.length > 0 && (
        <div style={{ marginTop: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, color: '#8A93A1', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '10px' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'var(--danger-soft)', color: 'var(--danger)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/></svg>
            </span>
            Top 3 deudores
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {top3.map((d, i) => {
              const av = getAvatarStyle(`${d.nombre}${d.apellido}`)
              const sym = getCurrencySymbol(d.moneda)
              return (
                <button
                  key={d.paciente_id}
                  onClick={() => setDetalleSlide({ paciente_id: d.paciente_id, nombre: d.nombre, apellido: d.apellido, os_nombre: d.os_nombre })}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: '#FFFFFF', border: '1px solid #E7E9EE', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .12s ease, box-shadow .12s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#D6DAE1'; e.currentTarget.style.boxShadow = '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E7E9EE'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", background: i === 0 ? 'linear-gradient(135deg, #FEF3C7, #FCD34D)' : '#F6F7F9', color: i === 0 ? '#92400E' : '#8A93A1' }}>
                    #{i + 1}
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0, background: av.bg, color: av.color, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '13px', letterSpacing: '-0.02em' }}>
                    {d.nombre[0]}{d.apellido[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#0B1220', letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.nombre} {d.apellido}
                    </div>
                    <span style={{ display: 'inline-flex', fontSize: '10.5px', fontWeight: 600, padding: '1px 6px', borderRadius: '100px', marginTop: '2px', background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
                      {d.os_nombre ?? 'Particular'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--danger)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 500, marginRight: '2px' }}>{sym}</span>
                    {fmtNum(d.saldo)}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ marginTop: '26px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid #E7E9EE', borderBottom: '1px solid #E7E9EE' }}>
        {/* Tab pills */}
        <div style={{ display: 'inline-flex', padding: '3px', gap: '2px', background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '8px' }}>
          {([
            { key: 'all' as const, label: 'Todos', count: countAll },
            { key: 'partic' as const, label: 'Particulares', count: countPartic },
            { key: 'os' as const, label: 'Obras sociales', count: countOS },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setTabFilter(tab.key)}
              style={{ border: 'none', padding: '5px 12px', fontSize: '12.5px', fontWeight: 500, borderRadius: '5px', cursor: 'pointer', background: tabFilter === tab.key ? '#FFFFFF' : 'transparent', color: tabFilter === tab.key ? '#0B1220' : '#5B6472', boxShadow: tabFilter === tab.key ? '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)' : 'none' }}
            >
              {tab.label}
              <span style={{ marginLeft: '4px', fontSize: '11px', fontVariantNumeric: 'tabular-nums', color: tabFilter === tab.key ? '#2563EB' : '#8A93A1', fontWeight: tabFilter === tab.key ? 600 : 400 }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Date range */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', left: '10px', pointerEvents: 'none', zIndex: 1 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as DateFilter)}
            style={{ padding: '5px 11px 5px 30px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--ink-2)', cursor: 'pointer', outline: 'none', appearance: 'auto' }}
          >
            <option value="mes_actual">Mes actual · {MESES_CORTO[mesArg].charAt(0).toUpperCase() + MESES_CORTO[mesArg].slice(1)} {anioArg}</option>
            <option value="mes_anterior">Mes anterior</option>
            <option value="semestre">Últimos 6 meses</option>
            <option value="anio">Año {anioArg}</option>
            <option value="historico">Histórico</option>
          </select>
        </div>

        {/* Status chips */}
        <div style={{ display: 'inline-flex', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {([
            { key: 'pendiente', label: 'Pendiente', dot: '#DC2626' },
            { key: 'pago_parcial', label: 'Pago parcial', dot: '#f59e0b' },
            { key: 'bonificado', label: 'Bonificado', dot: '#6b7280' },
          ]).map(chip => {
            const active = statusFilter.has(chip.key)
            return (
              <button key={chip.key} onClick={() => toggleStatus(chip.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '100px', border: active ? '1px solid #0B1220' : '1px solid #E7E9EE', background: active ? '#F6F7F9' : '#FFFFFF', fontSize: '12px', color: active ? '#0B1220' : '#5B6472', fontWeight: active ? 600 : 500, cursor: 'pointer' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: chip.dot, flexShrink: 0 }} />
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E7E9EE', borderRadius: '12px', overflow: 'hidden', marginTop: '14px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#5B6472', fontSize: '13px' }}>
            No hay sesiones con los filtros seleccionados
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Paciente</th>
                  <th style={TH}>Sesión</th>
                  <th style={TH} className="hidden lg:table-cell">Duración</th>
                  <th style={TH} className="hidden md:table-cell">Cobertura</th>
                  <th style={{ ...TH, textAlign: 'right' }} className="hidden md:table-cell">Monto</th>
                  <th style={{ ...TH, textAlign: 'right' }} className="hidden lg:table-cell">Cobrado</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Saldo</th>
                  <th style={TH}>Estado</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              {patientGroups.map(group => {
                const isExpanded = expandedPatients.has(group.paciente_id)
                const av = getAvatarStyle(`${group.nombre}${group.apellido}`)
                const saldoEntries = Object.entries(group.saldoPorMoneda).filter(([, v]) => v > 0)

                return (
                  <Fragment key={group.paciente_id}>
                    {/* Group header row */}
                    <tbody>
                      <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #E7E9EE', background: isExpanded ? '#F0F4FF' : undefined }}>
                        <td style={TD}>
                          <button
                            onClick={() => setDetalleSlide({ paciente_id: group.paciente_id, nombre: group.nombre, apellido: group.apellido, os_nombre: group.os_nombre })}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                          >
                            <div style={{ width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: av.bg, color: av.color, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '12.5px', letterSpacing: '-0.02em' }}>
                              {group.nombre[0]}{group.apellido[0]}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: '#0B1220', fontSize: '13.5px', letterSpacing: '-0.005em', whiteSpace: 'nowrap' }}>
                                {group.nombre} {group.apellido}
                              </div>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, marginTop: '2px', background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
                                {group.os_nombre ?? 'Particular'}
                              </span>
                            </div>
                          </button>
                        </td>
                        <td style={TD}>
                          <span style={{ fontSize: '12px', color: '#8A93A1', fontWeight: 500 }}>
                            {group.sessions.length} sesión{group.sessions.length !== 1 ? 'es' : ''}
                          </span>
                        </td>
                        <td style={{ ...TD, color: '#AEB5C0' }} className="hidden lg:table-cell">—</td>
                        <td style={TD} className="hidden md:table-cell">
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
                            {group.os_nombre ?? 'Particular'}
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: 'right', color: '#AEB5C0' }} className="hidden md:table-cell">—</td>
                        <td style={{ ...TD, textAlign: 'right', color: '#AEB5C0' }} className="hidden lg:table-cell">—</td>
                        <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {saldoEntries.map(([m, v]) => (
                            <div key={m} style={{ fontWeight: 700, color: 'var(--danger)', lineHeight: 1.3 }}>
                              <span style={{ fontSize: '11px', color: 'var(--danger)', opacity: 0.6, fontWeight: 500, marginRight: '2px' }}>{getCurrencySymbol(m)}</span>
                              {fmtNum(v)}
                              {saldoEntries.length > 1 && <span style={{ fontSize: '10px', marginLeft: '2px', opacity: 0.7 }}>{m}</span>}
                            </div>
                          ))}
                        </td>
                        <td style={TD}>
                          <StatusChip estado={group.sessions.find(s => s.estado_pago === 'pendiente')?.estado_pago ?? group.sessions[0]?.estado_pago ?? 'pendiente'} />
                        </td>
                        <td style={{ ...TD, textAlign: 'right' }}>
                          <button
                            onClick={() => toggleExpand(group.paciente_id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 11px', borderRadius: '7px', border: '1px solid #E7E9EE', background: isExpanded ? '#F0F4FF' : '#FFFFFF', color: '#1F2937', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .15s ease', flexShrink: 0 }}>
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                            <span className="hidden sm:inline">{isExpanded ? 'Ocultar' : 'Ver sesiones'}</span>
                          </button>
                        </td>
                      </tr>
                    </tbody>

                    {/* Session rows */}
                    {isExpanded && (
                      <tbody style={{ background: '#F9FAFC' }}>
                        {group.sessions.map((t, idx) => {
                          const dt = new Date(t.fecha_hora)
                          const dtArg = new Date(dt.getTime() - 3 * 60 * 60 * 1000)
                          const fechaStr = dtArg.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                          const horaStr = dtArg.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                          const saldo = Math.max(0, (t.monto ?? 0) - (t.monto_pagado ?? 0))
                          const isBonificado = t.estado_pago === 'bonificado'
                          const sym = getCurrencySymbol(t.moneda)
                          const isMenuOpen = openMenu === t.id
                          const isLast = idx === group.sessions.length - 1

                          return (
                            <tr key={t.id} style={{ borderBottom: isLast ? '2px solid #E7E9EE' : '1px dashed #E7E9EE' }}>
                              <td style={TD}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#AEB5C0" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                                    <path d="M3 3v10a2 2 0 002 2h16"/>
                                  </svg>
                                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px', color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>
                                    {fechaStr}<span style={{ color: '#8A93A1', fontSize: '11.5px', marginLeft: '4px' }}>{horaStr}</span>
                                  </div>
                                </div>
                              </td>
                              <td style={{ ...TD, color: '#AEB5C0' }}>—</td>
                              <td style={{ ...TD, color: '#5B6472', fontVariantNumeric: 'tabular-nums' }} className="hidden lg:table-cell">
                                {t.duracion_min} min
                              </td>
                              <td style={TD} className="hidden md:table-cell">
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
                                  {t.os_nombre ?? 'Particular'}
                                </span>
                              </td>
                              <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} className="hidden md:table-cell">
                                <span style={{ fontWeight: 600, color: '#1F2937' }}>
                                  <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>
                                  {fmtNum(t.monto)}
                                </span>
                              </td>
                              <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} className="hidden lg:table-cell">
                                {t.monto_pagado > 0 ? (
                                  <span style={{ fontWeight: 600, color: '#10b981' }}>
                                    <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>
                                    {fmtNum(t.monto_pagado)}
                                  </span>
                                ) : <span style={{ color: '#AEB5C0' }}>—</span>}
                              </td>
                              <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {saldo > 0 ? (
                                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--danger)', opacity: 0.6, fontWeight: 500, marginRight: '2px' }}>{sym}</span>
                                    {fmtNum(saldo)}
                                  </span>
                                ) : <span style={{ fontWeight: 500, color: '#AEB5C0' }}>—</span>}
                              </td>
                              <td style={TD}><StatusChip estado={t.estado_pago} /></td>
                              <td style={{ ...TD, textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  <button
                                    onClick={() => !isBonificado && setPagoSlide({ turno: t })}
                                    onTouchEnd={(e) => { e.preventDefault(); if (!isBonificado) setPagoSlide({ turno: t }) }}
                                    disabled={isBonificado}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 11px', borderRadius: '7px', background: isBonificado ? '#F1F3F6' : '#0B1220', color: isBonificado ? '#AEB5C0' : 'white', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: isBonificado ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', touchAction: 'manipulation' }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                                    <span className="hidden sm:inline">Registrar cobro</span>
                                  </button>
                                  <div style={{ position: 'relative' }} ref={isMenuOpen ? menuRef : undefined}>
                                    <button
                                      onClick={() => setOpenMenu(prev => prev === t.id ? null : t.id)}
                                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #E7E9EE', background: '#FFFFFF', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5B6472">
                                        <circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>
                                      </svg>
                                    </button>
                                    {isMenuOpen && (
                                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: '200px', background: '#FFFFFF', border: '1px solid #E7E9EE', borderRadius: '10px', boxShadow: '0 8px 24px rgba(16,24,40,.08)', padding: '6px', zIndex: 25 }}>
                                        <MenuBtn onClick={() => handleBonificar(t.id)}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="1.7"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/></svg>
                                          Bonificar
                                        </MenuBtn>
                                        <MenuBtn onClick={() => { setOpenMenu(null); openDetalle(t) }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="1.7"><path d="M4 6h16v12H4z"/><path d="M22 6l-10 7L2 6"/></svg>
                                          Enviar resumen
                                        </MenuBtn>
                                        <MenuBtn onClick={() => { setOpenMenu(null); openDetalle(t) }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B6472" strokeWidth="1.7"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                                          Ver detalle
                                        </MenuBtn>
                                        <div style={{ height: '1px', background: '#E7E9EE', margin: '4px 2px' }} />
                                        <MenuBtn danger onClick={() => { setOpenMenu(null); setConfirmDelete(t.id) }}>
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.7"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                                          Eliminar
                                        </MenuBtn>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    )}
                  </Fragment>
                )
              })}
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p style={{ marginTop: '14px', fontSize: '12px', color: '#8A93A1', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        Las bonificaciones no impactan en el adeudado histórico. Los importes en USD/EUR muestran su símbolo correspondiente.
      </p>

      <RegistrarPagoSlide open={!!pagoSlide} onClose={() => setPagoSlide(null)} turno={pagoSlide?.turno ?? null} onSuccess={() => router.refresh()} />
      <DetallePacienteSlide open={!!detalleSlide} onClose={() => setDetalleSlide(null)} pacienteId={detalleSlide?.paciente_id ?? null} pacienteNombre={detalleSlide?.nombre ?? ''} pacienteApellido={detalleSlide?.apellido ?? ''} osNombre={detalleSlide?.os_nombre ?? null} terapeutaId={terapeutaId} onSuccess={() => router.refresh()} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar cobro"
        message="¿Estás seguro de que querés eliminar este registro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => confirmDelete && handleEliminar(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
    </>
  )
}
