'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

const AVATAR_COLORS = ['#001a48', '#2563EB', '#7c3aed', '#059669', '#d97706', '#dc2626']

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  pago_parcial: 'Pago parcial',
  bonificado: 'Bonificado',
}

const ESTADO_CHIP_CLASS: Record<string, string> = {
  pendiente: 'bg-red-100 text-red-700',
  pago_parcial: 'bg-amber-100 text-amber-700',
  bonificado: 'bg-gray-100 text-gray-500',
}

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function fmtMoney(n: number, moneda = 'ARS') {
  return `${moneda} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`
}

function getArgNow() {
  const now = new Date()
  return new Date(now.getTime() - 3 * 60 * 60 * 1000)
}

function getMesBoundaries(year: number, month: number) {
  const inicio = new Date(Date.UTC(year, month, 1, 3, 0, 0))
  const fin = new Date(Date.UTC(year, month + 1, 1, 3, 0, 0))
  return { inicio, fin }
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
  const [detalleSlide, setDetalleSlide] = useState<{
    paciente_id: string
    nombre: string
    apellido: string
    os_nombre: string | null
  } | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  // Compute date boundaries based on filter
  const dateBoundaries = useMemo(() => {
    const hoy = getArgNow()
    const m = hoy.getUTCMonth()
    const y = hoy.getUTCFullYear()
    if (dateFilter === 'mes_actual') {
      return getMesBoundaries(y, m)
    } else if (dateFilter === 'mes_anterior') {
      const prevM = m === 0 ? 11 : m - 1
      const prevY = m === 0 ? y - 1 : y
      return getMesBoundaries(prevY, prevM)
    } else if (dateFilter === 'semestre') {
      const inicio6 = new Date(Date.UTC(m >= 6 ? y : y - 1, m >= 6 ? m - 6 : m + 6, 1, 3, 0, 0))
      return { inicio: inicio6, fin: new Date(Date.UTC(y, m + 1, 1, 3, 0, 0)) }
    } else if (dateFilter === 'anio') {
      return { inicio: new Date(Date.UTC(y, 0, 1, 3, 0, 0)), fin: new Date(Date.UTC(y + 1, 0, 1, 3, 0, 0)) }
    }
    return null // historico
  }, [dateFilter])

  // Filter turnos
  const filtered = useMemo(() => {
    return turnos.filter(t => {
      // Tab
      if (tabFilter === 'partic' && t.os_config_id) return false
      if (tabFilter === 'os' && !t.os_config_id) return false
      // Status
      if (!statusFilter.has(t.estado_pago)) return false
      // Date
      if (dateBoundaries) {
        const dt = new Date(t.fecha_hora)
        if (dt < dateBoundaries.inicio || dt >= dateBoundaries.fin) return false
      }
      return true
    })
  }, [turnos, tabFilter, statusFilter, dateBoundaries])

  // Counts for tabs
  const countAll = useMemo(() => turnos.filter(t => statusFilter.has(t.estado_pago)).length, [turnos, statusFilter])
  const countPartic = useMemo(() => turnos.filter(t => !t.os_config_id && statusFilter.has(t.estado_pago)).length, [turnos, statusFilter])
  const countOS = useMemo(() => turnos.filter(t => !!t.os_config_id && statusFilter.has(t.estado_pago)).length, [turnos, statusFilter])

  function toggleStatus(s: string) {
    setStatusFilter(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  async function handleBonificar(turnoId: string) {
    setOpenMenu(null)
    const res = await fetch('/api/cobros/bonificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turnoId }),
    })
    if (res.ok) router.refresh()
    else {
      const data = await res.json()
      alert(data.error || 'Error al bonificar')
    }
  }

  async function handleEliminar(turnoId: string) {
    setConfirmDelete(null)
    const res = await fetch('/api/cobros/eliminar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turno_id: turnoId }),
    })
    if (res.ok) router.refresh()
    else {
      const data = await res.json()
      alert(data.error || 'Error al eliminar')
    }
  }

  function openDetalle(t: TurnoDeuda) {
    setDetalleSlide({
      paciente_id: t.paciente_id,
      nombre: t.paciente_nombre,
      apellido: t.paciente_apellido,
      os_nombre: t.os_nombre,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ color: '#001a48' }}>Cobros</h1>
        <p className="text-sm text-gray-500 mt-1">Gestioná los cobros y pagos de tus sesiones</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Particulares */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Particulares</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Adeudado histórico</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: '#dc2626' }}>
                {fmtMoney(summary.particAdeudado, moneda)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.particAdeudadoCount} sesión{summary.particAdeudadoCount !== 1 ? 'es' : ''}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Mes en curso</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: '#dc2626' }}>
                {fmtMoney(summary.particMesActual, moneda)}
              </p>
            </div>
          </div>
        </div>
        {/* Obras Sociales */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Obras Sociales</p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Adeudado histórico</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: '#dc2626' }}>
                {fmtMoney(summary.osAdeudado, moneda)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{summary.osAdeudadoCount} sesión{summary.osAdeudadoCount !== 1 ? 'es' : ''}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">Mes en curso</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: '#dc2626' }}>
                {fmtMoney(summary.osMesActual, moneda)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top debtors */}
      {top3.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mayores deudores</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {top3.map((d, i) => (
              <button
                key={d.paciente_id}
                onClick={() => setDetalleSlide({ paciente_id: d.paciente_id, nombre: d.nombre, apellido: d.apellido, os_nombre: d.os_nombre })}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:border-gray-200 transition-all text-left w-full"
              >
                <span className="text-lg font-bold text-gray-300 w-5 flex-shrink-0">#{i + 1}</span>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: getAvatarColor(`${d.nombre}${d.apellido}`) }}
                >
                  {d.nombre[0]}{d.apellido[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.nombre} {d.apellido}</p>
                  {d.os_nombre && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                      {d.os_nombre}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: '#dc2626' }}>
                  {fmtMoney(d.saldo, d.moneda)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Tab pills */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { key: 'all', label: 'Todos', count: countAll },
            { key: 'partic', label: 'Particulares', count: countPartic },
            { key: 'os', label: 'OS', count: countOS },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setTabFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tabFilter === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tabFilter === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Date filter */}
        <select
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value as DateFilter)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="mes_actual">Mes actual</option>
          <option value="mes_anterior">Mes anterior</option>
          <option value="semestre">Semestre</option>
          <option value="anio">Año</option>
          <option value="historico">Histórico</option>
        </select>

        {/* Status chips */}
        <div className="flex gap-2">
          {([
            { key: 'pendiente', label: 'Pendiente', active: 'bg-red-500 text-white', inactive: 'bg-gray-100 text-gray-600' },
            { key: 'pago_parcial', label: 'Pago parcial', active: 'bg-amber-500 text-white', inactive: 'bg-gray-100 text-gray-600' },
            { key: 'bonificado', label: 'Bonificado', active: 'bg-gray-400 text-white', inactive: 'bg-gray-100 text-gray-600' },
          ]).map(chip => (
            <button
              key={chip.key}
              onClick={() => toggleStatus(chip.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                statusFilter.has(chip.key) ? chip.active : chip.inactive
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-3 block">account_balance_wallet</span>
            <p className="text-sm">No hay sesiones con los filtros seleccionados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paciente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sesión</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Duración</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cobertura</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Cobrado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Saldo</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const dt = new Date(t.fecha_hora)
                  const dtArg = new Date(dt.getTime() - 3 * 60 * 60 * 1000)
                  const fechaStr = dtArg.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                  const horaStr = dtArg.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                  const saldo = Math.max(0, (t.monto ?? 0) - (t.monto_pagado ?? 0))
                  const isBonificado = t.estado_pago === 'bonificado'
                  const isConfirmingDelete = confirmDelete === t.id

                  return (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      {/* Patient */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDetalle(t)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: getAvatarColor(`${t.paciente_nombre}${t.paciente_apellido}`) }}
                          >
                            {t.paciente_nombre[0]}{t.paciente_apellido[0]}
                          </div>
                          <span className="font-medium text-gray-900 text-sm">{t.paciente_nombre} {t.paciente_apellido}</span>
                        </button>
                      </td>
                      {/* Session */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        <span>{fechaStr}</span>
                        <span className="text-gray-400 mx-1">·</span>
                        <span>{horaStr}</span>
                      </td>
                      {/* Duration */}
                      <td className="px-4 py-3 text-gray-500 text-sm hidden md:table-cell">{t.duracion_min} min</td>
                      {/* Coverage */}
                      <td className="px-4 py-3">
                        {t.os_config_id ? (
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                            {t.os_nombre ?? 'OS'}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700">
                            Particular
                          </span>
                        )}
                      </td>
                      {/* Monto */}
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 text-sm font-medium">
                        {fmtMoney(t.monto, t.moneda)}
                      </td>
                      {/* Cobrado */}
                      <td className="px-4 py-3 text-right tabular-nums text-green-700 text-sm hidden md:table-cell">
                        {fmtMoney(t.monto_pagado, t.moneda)}
                      </td>
                      {/* Saldo */}
                      <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold" style={{ color: saldo > 0 ? '#dc2626' : '#374151' }}>
                        {fmtMoney(saldo, t.moneda)}
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ESTADO_CHIP_CLASS[t.estado_pago] ?? 'bg-gray-100 text-gray-500'}`}>
                          {ESTADO_LABELS[t.estado_pago] ?? t.estado_pago}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-xs text-gray-600">¿Eliminar?</span>
                            <button
                              onClick={() => handleEliminar(t.id)}
                              className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                            >Sí</button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                            >No</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => !isBonificado && setPagoSlide({ turno: t })}
                              disabled={isBonificado}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              style={!isBonificado ? { borderColor: '#001a48', color: '#001a48' } : { borderColor: '#d1d5db', color: '#9ca3af' }}
                            >
                              Registrar cobro
                            </button>
                            {/* Dropdown */}
                            <div className="relative" ref={openMenu === t.id ? menuRef : undefined}>
                              <button
                                onClick={() => setOpenMenu(prev => prev === t.id ? null : t.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 2a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 110 4 2 2 0 010-4z" />
                                </svg>
                              </button>
                              {openMenu === t.id && (
                                <div className="absolute right-0 top-8 z-50 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 text-sm">
                                  <button
                                    onClick={() => handleBonificar(t.id)}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors"
                                  >
                                    Bonificar
                                  </button>
                                  <button
                                    onClick={() => { setOpenMenu(null); openDetalle(t) }}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 transition-colors"
                                  >
                                    Ver detalle
                                  </button>
                                  <hr className="my-1 border-gray-100" />
                                  <button
                                    onClick={() => { setOpenMenu(null); setConfirmDelete(t.id) }}
                                    className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition-colors"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registrar Pago Slide */}
      <RegistrarPagoSlide
        open={!!pagoSlide}
        onClose={() => setPagoSlide(null)}
        turno={pagoSlide?.turno ?? null}
        onSuccess={() => router.refresh()}
      />

      {/* Detalle Paciente Slide */}
      <DetallePacienteSlide
        open={!!detalleSlide}
        onClose={() => setDetalleSlide(null)}
        pacienteId={detalleSlide?.paciente_id ?? null}
        pacienteNombre={detalleSlide?.nombre ?? ''}
        pacienteApellido={detalleSlide?.apellido ?? ''}
        osNombre={detalleSlide?.os_nombre ?? null}
        terapeutaId={terapeutaId}
      />
    </div>
  )
}
