'use client'

import { useEffect, useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'
import { createClient } from '@/lib/supabase/client'
import type { Cobro } from '@/types/database'

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

const MEDIO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
}

interface RegistrarPagoSlideProps {
  open: boolean
  onClose: () => void
  turno: TurnoDeuda | null
  onSuccess: () => void
}

export default function RegistrarPagoSlide({ open, onClose, turno, onSuccess }: RegistrarPagoSlideProps) {
  const saldo = turno ? Math.max(0, (turno.monto ?? 0) - (turno.monto_pagado ?? 0)) : 0

  const todayStr = () => {
    const ahora = new Date()
    const argDate = new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
    return argDate.toISOString().slice(0, 10)
  }

  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState<'efectivo' | 'transferencia' | 'mercado_pago'>('transferencia')
  const [fechaCobro, setFechaCobro] = useState(todayStr())
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historial, setHistorial] = useState<Cobro[]>([])

  // Reset when turno changes
  useEffect(() => {
    if (turno) {
      setMonto(String(saldo))
      setMedioPago('transferencia')
      setFechaCobro(todayStr())
      setNotas('')
      setError(null)
      setLoading(false)

      // Fetch cobro history
      const supabase = createClient()
      supabase
        .from('cobros')
        .select('*')
        .eq('turno_id', turno.id)
        .order('fecha_cobro', { ascending: false })
        .then(({ data }) => setHistorial(data ?? []))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno?.id])

  if (!turno) return null

  const montoNum = parseFloat(monto) || 0
  const quedaPagada = montoNum >= saldo
  const nuevoSaldo = Math.max(0, saldo - montoNum)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turno) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cobros/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: turno.id,
          monto_cobrado: montoNum,
          medio_pago: medioPago,
          fecha_cobro: fechaCobro,
          notas: notas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al registrar cobro')
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const pacienteNombre = `${turno.paciente_nombre} ${turno.paciente_apellido}`

  const fechaHoraDate = new Date(turno.fecha_hora)
  const argDate = new Date(fechaHoraDate.getTime() - 3 * 60 * 60 * 1000)
  const fechaStr = argDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const horaStr = argDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

  const fmtCobro = (cobro: Cobro) => {
    const d = new Date(cobro.fecha_cobro)
    return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Registrar cobro`}
      subtitle={pacienteNombre}
      width="md"
    >
      <div className="space-y-5">
        {/* Session meta */}
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #001a48 0%, #2563EB 100%)' }}
          >
            {turno.paciente_nombre[0]}{turno.paciente_apellido[0]}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{pacienteNombre}</p>
            <p className="text-xs text-gray-500">{fechaStr} · {horaStr} · {turno.duracion_min} min</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total</p>
            <p className="font-bold text-gray-900 text-sm tabular-nums">{turno.moneda} {fmtMoney(turno.monto)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Cobrado</p>
            <p className="font-bold text-green-700 text-sm tabular-nums">{turno.moneda} {fmtMoney(turno.monto_pagado)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Saldo</p>
            <p className="font-bold text-red-600 text-sm tabular-nums">{turno.moneda} {fmtMoney(saldo)}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Monto cobrado <span className="text-gray-400 text-xs">({turno.moneda})</span>
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm tabular-nums"
              placeholder="0"
              required
            />
          </div>

          {/* Medio de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Medio de pago</label>
            <div className="flex gap-2">
              {(['efectivo', 'transferencia', 'mercado_pago'] as const).map(mp => (
                <button
                  key={mp}
                  type="button"
                  onClick={() => setMedioPago(mp)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                    medioPago === mp
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {MEDIO_PAGO_LABELS[mp]}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha del cobro</label>
            <input
              type="date"
              value={fechaCobro}
              onChange={e => setFechaCobro(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              placeholder="Ej: pago en dos partes..."
            />
          </div>

          {/* Status preview */}
          {montoNum > 0 && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
              quedaPagada
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {quedaPagada
                ? '✓ La sesión quedará marcada como Pagada'
                : `Pago parcial. Quedará un saldo de ${turno.moneda} ${fmtMoney(nuevoSaldo)}`
              }
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || montoNum <= 0}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: loading || montoNum <= 0 ? '#94a3b8' : 'linear-gradient(90deg, #001a48 0%, #002d72 100%)' }}
            >
              {loading ? 'Registrando...' : 'Registrar cobro'}
            </button>
          </div>
        </form>

        {/* Historial */}
        {historial.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cobros anteriores</p>
            <div className="space-y-2">
              {historial.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
                  <div>
                    <span className="text-gray-700 font-medium">{fmtCobro(c)}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-500">{MEDIO_PAGO_LABELS[c.medio_pago] ?? c.medio_pago}</span>
                    {c.notas && <p className="text-xs text-gray-400 mt-0.5">{c.notas}</p>}
                  </div>
                  <span className="font-semibold text-green-700 tabular-nums">
                    {c.moneda} {fmtMoney(c.monto_cobrado)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SlideOver>
  )
}
