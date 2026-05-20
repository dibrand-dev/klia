'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SlideOver from '@/components/ui/SlideOver'
import { createClient } from '@/lib/supabase/client'

interface SesionDetalle {
  id: string
  fecha_hora: string
  duracion_min: number
  monto: number | null
  moneda: string
  estado_pago: 'pendiente' | 'pagado' | 'pago_parcial' | 'bonificado' | null
  monto_pagado: number | null
}

interface DetallePacienteSlideProps {
  open: boolean
  onClose: () => void
  pacienteId: string | null
  pacienteNombre: string
  pacienteApellido: string
  osNombre: string | null
  terapeutaId: string
}

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  pago_parcial: 'Pago parcial',
  bonificado: 'Bonificado',
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-red-100 text-red-700',
  pagado: 'bg-green-100 text-green-700',
  pago_parcial: 'bg-amber-100 text-amber-700',
  bonificado: 'bg-gray-100 text-gray-500',
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default function DetallePacienteSlide({
  open,
  onClose,
  pacienteId,
  pacienteNombre,
  pacienteApellido,
  osNombre,
  terapeutaId,
}: DetallePacienteSlideProps) {
  const now = new Date()
  const argNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  const [mes, setMes] = useState(argNow.getUTCMonth())      // 0-indexed
  const [anio, setAnio] = useState(argNow.getUTCFullYear())
  const [sesiones, setSesiones] = useState<SesionDetalle[]>([])
  const [loading, setLoading] = useState(false)
  const [enviandoResumen, setEnviandoResumen] = useState(false)
  const [resumenEnviado, setResumenEnviado] = useState(false)
  const [resumenError, setResumenError] = useState<string | null>(null)

  useEffect(() => {
    if (!pacienteId || !open) return
    setLoading(true)
    const supabase = createClient()
    const inicioMes = new Date(Date.UTC(anio, mes, 1, 3, 0, 0))
    const finMes = new Date(Date.UTC(anio, mes + 1, 1, 3, 0, 0))

    supabase
      .from('turnos')
      .select('id, fecha_hora, duracion_min, monto, moneda, estado_pago, monto_pagado')
      .eq('paciente_id', pacienteId)
      .eq('terapeuta_id', terapeutaId)
      .in('estado', ['realizado', 'no_asistio'])
      .gte('fecha_hora', inicioMes.toISOString())
      .lt('fecha_hora', finMes.toISOString())
      .order('fecha_hora')
      .then(({ data }) => {
        setSesiones((data ?? []) as SesionDetalle[])
        setLoading(false)
      })
  }, [pacienteId, mes, anio, open, terapeutaId])

  // Reset resumen state when patient changes
  useEffect(() => {
    setResumenEnviado(false)
    setResumenError(null)
  }, [pacienteId])

  if (!pacienteId) return null

  const fmtMoney = (n: number, moneda = 'ARS') =>
    `${moneda} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`

  // Stats
  const totalMes = sesiones.reduce((acc, s) => acc + (s.estado_pago !== 'bonificado' ? (s.monto ?? 0) : 0), 0)
  const cobrado = sesiones.reduce((acc, s) => acc + (s.monto_pagado ?? 0), 0)
  const pendiente = Math.max(0, totalMes - cobrado)
  const monedaDefault = sesiones[0]?.moneda || 'ARS'

  // Month selector options (current + 5 months back)
  const monthOptions: { mes: number; anio: number; label: string }[] = []
  for (let i = 0; i < 6; i++) {
    let m = argNow.getUTCMonth() - i
    let y = argNow.getUTCFullYear()
    if (m < 0) { m += 12; y -= 1 }
    monthOptions.push({ mes: m, anio: y, label: `${MESES[m].charAt(0).toUpperCase()}${MESES[m].slice(1)} ${y}` })
  }

  const mesLabel = `${MESES[mes].charAt(0).toUpperCase()}${MESES[mes].slice(1)} ${anio}`
  const nombreCompleto = `${pacienteNombre} ${pacienteApellido}`

  async function handleEnviarResumen() {
    if (!pacienteId) return
    setEnviandoResumen(true)
    setResumenError(null)
    try {
      const res = await fetch('/api/cobros/resumen-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paciente_id: pacienteId, mes: mes + 1, anio }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      setResumenEnviado(true)
    } catch (err) {
      setResumenError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setEnviandoResumen(false)
    }
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={nombreCompleto}
      subtitle={osNombre ? `OS: ${osNombre}` : 'Particular'}
      width="md"
    >
      <div className="space-y-5">
        {/* Month picker */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Período</label>
          <select
            value={`${mes}-${anio}`}
            onChange={e => {
              const [m, y] = e.target.value.split('-').map(Number)
              setMes(m)
              setAnio(y)
            }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {monthOptions.map(o => (
              <option key={`${o.mes}-${o.anio}`} value={`${o.mes}-${o.anio}`}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Sesiones</p>
            <p className="font-bold text-gray-900 text-lg">{sesiones.length}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total del mes</p>
            <p className="font-bold text-gray-900 text-sm tabular-nums">{fmtMoney(totalMes, monedaDefault)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Cobrado</p>
            <p className="font-bold text-green-700 text-sm tabular-nums">{fmtMoney(cobrado, monedaDefault)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Pendiente</p>
            <p className="font-bold text-red-600 text-sm tabular-nums">{fmtMoney(pendiente, monedaDefault)}</p>
          </div>
        </div>

        {/* Session list */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{mesLabel}</p>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <span className="material-symbols-outlined animate-spin text-xl mr-2">progress_activity</span>
              Cargando...
            </div>
          ) : sesiones.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Sin sesiones en este período</div>
          ) : (
            <div className="space-y-2">
              {sesiones.map(s => {
                const dt = new Date(s.fecha_hora)
                const dtArg = new Date(dt.getTime() - 3 * 60 * 60 * 1000)
                const fechaStr = dtArg.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                const horaStr = dtArg.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                const estadoKey = s.estado_pago ?? 'pendiente'
                return (
                  <div key={s.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[40px]">
                        <p className="text-sm font-semibold text-gray-900 tabular-nums">{fechaStr}</p>
                        <p className="text-xs text-gray-400 tabular-nums">{horaStr}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{s.duracion_min} min</p>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${ESTADO_COLORS[estadoKey] ?? 'bg-gray-100 text-gray-500'}`}>
                          {ESTADO_LABELS[estadoKey] ?? estadoKey}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: (s.monto ?? 0) - (s.monto_pagado ?? 0) > 0 ? '#dc2626' : '#374151' }}>
                        {s.monto != null ? fmtMoney(s.monto, s.moneda) : '—'}
                      </p>
                      {(s.monto_pagado ?? 0) > 0 && s.estado_pago !== 'pagado' && (
                        <p className="text-xs text-green-600 tabular-nums">
                          Cobrado: {fmtMoney(s.monto_pagado ?? 0, s.moneda)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-2 border-t border-gray-100 space-y-3">
          {resumenEnviado && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
              ✓ Resumen enviado correctamente
            </div>
          )}
          {resumenError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {resumenError}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleEnviarResumen}
              disabled={enviandoResumen || sesiones.length === 0}
              className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">mail</span>
              {enviandoResumen ? 'Enviando...' : 'Enviar resumen'}
            </button>
            <Link
              href={`/pacientes/${pacienteId}`}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'linear-gradient(90deg, #001a48 0%, #002d72 100%)' }}
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              Ver ficha
            </Link>
          </div>
        </div>
      </div>
    </SlideOver>
  )
}
