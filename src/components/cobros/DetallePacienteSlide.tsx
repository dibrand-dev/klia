'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SlideOver from '@/components/ui/SlideOver'
import { createClient } from '@/lib/supabase/client'

interface SesionPendiente {
  id: string
  fecha_hora: string
  duracion_min: number
  monto: number | null
  monto_pagado: number | null
  moneda: string
  estado_pago: string | null
}

interface PreviewSesion extends SesionPendiente {
  resultado: 'pagado' | 'parcial' | 'sin_cambio'
  aplicado: number
}

interface Props {
  open: boolean
  onClose: () => void
  pacienteId: string | null
  pacienteNombre: string
  pacienteApellido: string
  osNombre: string | null
  terapeutaId: string
  onSuccess?: () => void
}

const AVATAR_VARIANTS = [
  { bg: 'linear-gradient(145deg, #E3E9F6, #C9D3E9)', color: '#16389F' },
  { bg: 'linear-gradient(145deg, #F4E4E0, #E5C9C0)', color: '#8A3520' },
  { bg: 'linear-gradient(145deg, #E4F0E4, #C0DBC0)', color: '#205A2E' },
  { bg: 'linear-gradient(145deg, #F2E8F4, #DCC0E0)', color: '#5B3DC9' },
  { bg: 'linear-gradient(145deg, #F4EEDC, #E0D2A6)', color: '#7A5A0F' },
]

function getAvatarStyle(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h += name.charCodeAt(i)
  return AVATAR_VARIANTS[h % AVATAR_VARIANTS.length]
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function getCurrencySymbol(moneda: string) {
  if (moneda === 'USD') return 'US$'
  if (moneda === 'EUR') return '€'
  return '$'
}

const STCHIP: Record<string, { bg: string; color: string; label: string }> = {
  pendiente:    { bg: '#FEE2E2', color: '#DC2626', label: 'Pendiente' },
  pagado:       { bg: '#DCFCE7', color: '#047857', label: 'Pagado' },
  pago_parcial: { bg: '#FEF3C7', color: '#B45309', label: 'Parcial' },
  bonificado:   { bg: '#F3F4F6', color: '#6b7280', label: 'Bonificada' },
}

function calcularPreview(monto: number, sesiones: SesionPendiente[]): PreviewSesion[] {
  let restante = monto
  return sesiones.map(s => {
    const saldo = (s.monto ?? 0) - (s.monto_pagado ?? 0)
    if (saldo <= 0) return { ...s, resultado: 'sin_cambio' as const, aplicado: 0 }
    if (restante >= saldo) {
      restante -= saldo
      return { ...s, resultado: 'pagado' as const, aplicado: saldo }
    } else if (restante > 0) {
      const aplicado = restante
      restante = 0
      return { ...s, resultado: 'parcial' as const, aplicado }
    }
    return { ...s, resultado: 'sin_cambio' as const, aplicado: 0 }
  })
}

export default function DetallePacienteSlide({ open, onClose, pacienteId, pacienteNombre, pacienteApellido, osNombre, terapeutaId, onSuccess }: Props) {
  const now = new Date()
  const argNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  const [sesiones, setSesiones] = useState<SesionPendiente[]>([])
  const [loading, setLoading] = useState(false)
  const [enviandoResumen, setEnviandoResumen] = useState(false)
  const [resumenEnviado, setResumenEnviado] = useState(false)
  const [resumenError, setResumenError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Pago a cuenta state
  const [showPagoACuenta, setShowPagoACuenta] = useState(false)
  const [montoPago, setMontoPago] = useState('')
  const [medioPago, setMedioPago] = useState<'efectivo' | 'transferencia' | 'mercado_pago'>('efectivo')
  const [loadingPago, setLoadingPago] = useState(false)
  const [pagoError, setPagoError] = useState<string | null>(null)

  useEffect(() => {
    if (!pacienteId || !open) return
    setLoading(true)
    const supabase = createClient()
    supabase.from('turnos')
      .select('id, fecha_hora, duracion_min, monto, monto_pagado, moneda, estado_pago')
      .eq('paciente_id', pacienteId)
      .eq('terapeuta_id', terapeutaId)
      .eq('estado', 'realizado')
      .in('estado_pago', ['pendiente', 'pago_parcial'])
      .eq('pagado', false)
      .lte('fecha_hora', new Date().toISOString())
      .order('fecha_hora', { ascending: true })
      .then(({ data }) => { setSesiones((data ?? []) as SesionPendiente[]); setLoading(false) })
  }, [pacienteId, open, terapeutaId, refreshKey])

  useEffect(() => {
    setResumenEnviado(false)
    setResumenError(null)
  }, [pacienteId])

  if (!pacienteId) return null

  const sesionesConMonto = sesiones.filter(s => s.monto != null && s.monto > 0)
  const sesionesSinMonto = sesiones.filter(s => !s.monto || s.monto === 0)

  const monedaDefault = sesionesConMonto[0]?.moneda || 'ARS'
  const sym = getCurrencySymbol(monedaDefault)

  const totalFacturado = sesionesConMonto.reduce((acc, s) => acc + (s.monto ?? 0), 0)
  const totalCobradoParcial = sesionesConMonto.reduce((acc, s) => acc + (s.monto_pagado ?? 0), 0)
  const deudaTotal = sesionesConMonto.reduce((acc, s) => acc + Math.max(0, (s.monto ?? 0) - (s.monto_pagado ?? 0)), 0)
  const sesionesParciales = sesionesConMonto.filter(s => s.estado_pago === 'pago_parcial').length

  // Group by month for display (only sesionesConMonto)
  const sesionesPorMes = sesionesConMonto.reduce((acc, s) => {
    const dt = new Date(new Date(s.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    const label = dt.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    if (!acc[key]) acc[key] = { label, sesiones: [] }
    acc[key].sesiones.push(s)
    return acc
  }, {} as Record<string, { label: string; sesiones: SesionPendiente[] }>)

  const av = getAvatarStyle(`${pacienteNombre}${pacienteApellido}`)

  async function handleEnviarResumen() {
    if (!pacienteId) return
    setEnviandoResumen(true); setResumenError(null)
    try {
      const mes = argNow.getUTCMonth() + 1
      const anio = argNow.getUTCFullYear()
      const res = await fetch('/api/cobros/resumen-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paciente_id: pacienteId, mes, anio }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      setResumenEnviado(true)
    } catch (err) {
      setResumenError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setEnviandoResumen(false)
    }
  }

  async function handlePagoACuenta() {
    if (!pacienteId) return
    setLoadingPago(true); setPagoError(null)
    try {
      const res = await fetch('/api/cobros/pago-a-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paciente_id: pacienteId, monto_recibido: Number(montoPago), medio_pago: medioPago }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al registrar')
      setShowPagoACuenta(false)
      setMontoPago('')
      setMedioPago('efectivo')
      setRefreshKey(k => k + 1)
      onSuccess?.()
    } catch (err) {
      setPagoError(err instanceof Error ? err.message : 'Error al registrar el pago')
    } finally {
      setLoadingPago(false)
    }
  }

  const soHeader = (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #E7E9EE', display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'linear-gradient(180deg, #F4F7FE 0%, transparent 100%)', flexShrink: 0 }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: av.bg, color: av.color, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '16px', letterSpacing: '-0.02em' }}>
        {pacienteNombre[0]}{pacienteApellido[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0B1220', letterSpacing: '-0.015em' }}>
          {pacienteNombre} {pacienteApellido}
        </div>
        <div style={{ fontSize: '12px', color: '#5B6472', marginTop: '3px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: osNombre ? '#ECF0FF' : '#EFF4FF', color: osNombre ? '#002d72' : '#2563EB' }}>
            {osNombre ?? 'Particular'}
          </span>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid transparent', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F6F7F9'; e.currentTarget.style.borderColor = '#E7E9EE' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
        title="Cerrar"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1F2937" strokeWidth="1.8"><path d="M6 6l12 12M18 6l-12 12"/></svg>
      </button>
    </div>
  )

  const soFooter = (
    <div style={{ borderTop: '1px solid #E7E9EE', padding: '12px 16px', display: 'flex', gap: '8px', background: '#F6F7F9' }}>
      <button
        onClick={handleEnviarResumen}
        disabled={enviandoResumen || sesiones.length === 0}
        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: enviandoResumen || sesiones.length === 0 ? 'not-allowed' : 'pointer', border: '1px solid #E7E9EE', background: '#FFFFFF', color: '#1F2937', opacity: enviandoResumen || sesiones.length === 0 ? 0.5 : 1 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16v12H4z"/><path d="M22 6l-10 7L2 6"/></svg>
        {enviandoResumen ? 'Enviando...' : 'Enviar resumen'}
      </button>
      <Link
        href={`/pacientes/${pacienteId}`}
        onClick={onClose}
        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, textDecoration: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: 'white', border: 'none', boxShadow: '0 4px 10px rgba(37,99,235,0.20)' }}
      >
        Ver ficha completa
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </Link>
    </div>
  )

  const h4Style: React.CSSProperties = { margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8A93A1' }

  const previewSesiones = montoPago && Number(montoPago) > 0
    ? calcularPreview(Number(montoPago), sesionesConMonto).filter(s => s.aplicado > 0)
    : []

  const btnDisabled = !montoPago || Number(montoPago) <= 0 || loadingPago

  return (
    <SlideOver open={open} onClose={onClose} title="" header={soHeader} footer={soFooter} noPadding width="md">
      <div style={{ padding: '20px 22px' }}>

        <h4 style={h4Style}>Deuda total — todos los meses</h4>

        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          {/* Sesiones pendientes */}
          <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A93A1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Sesiones
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: '#0B1220' }}>{sesionesConMonto.length}</div>
            <div style={{ fontSize: '11px', color: '#5B6472', marginTop: '3px' }}>
              {sesionesParciales > 0 ? `${sesionesConMonto.length - sesionesParciales} pendiente${sesionesConMonto.length - sesionesParciales !== 1 ? 's' : ''} · ${sesionesParciales} parcial${sesionesParciales !== 1 ? 'es' : ''}` : 'con saldo pendiente'}
            </div>
          </div>
          {/* Total facturado */}
          <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A93A1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Total facturado
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: '#0B1220' }}>
              <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>{fmtNum(totalFacturado)}
              <span style={{ fontSize: '13px', color: '#5B6472', marginLeft: '4px' }}>{monedaDefault}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#5B6472', marginTop: '3px' }}>en sesiones con saldo</div>
          </div>
          {/* Cobrado parcialmente */}
          <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Cobrado
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: '#047857' }}>
              <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>{fmtNum(totalCobradoParcial)}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '3px' }}>pagos parciales registrados</div>
          </div>
          {/* Saldo pendiente */}
          <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Saldo pendiente
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: '#DC2626' }}>
              <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>{fmtNum(deudaTotal)}
            </div>
            <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '3px' }}>a cobrar</div>
          </div>
        </div>

        {/* Pago a cuenta */}
        {deudaTotal > 0 && !showPagoACuenta && (
          <button
            onClick={() => setShowPagoACuenta(true)}
            style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: 'white', boxShadow: '0 4px 10px rgba(37,99,235,0.20)', marginBottom: '16px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Registrar pago a cuenta · {sym} {fmtNum(deudaTotal)} pendientes
          </button>
        )}

        {showPagoACuenta && (
          <div style={{ marginBottom: '16px', background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0B1220' }}>Pago a cuenta</span>
              <button
                onClick={() => { setShowPagoACuenta(false); setMontoPago(''); setPagoError(null) }}
                style={{ width: '24px', height: '24px', display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8A93A1" strokeWidth="2"><path d="M6 6l12 12M18 6l-12 12"/></svg>
              </button>
            </div>

            <div style={{ fontSize: '12px', color: '#5B6472', marginBottom: '12px', padding: '8px 12px', background: '#FEF3C7', borderRadius: '8px', border: '1px solid #FDE68A' }}>
              Deuda total: <span style={{ fontWeight: 700, color: '#B45309' }}>{sym} {fmtNum(deudaTotal)} {monedaDefault}</span>
              <span style={{ marginLeft: '6px', color: '#92400E' }}>· {sesiones.length} sesión{sesiones.length !== 1 ? 'es' : ''}</span>
            </div>

            {/* Monto */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', display: 'block', marginBottom: '5px' }}>Monto recibido</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E7E9EE', borderRadius: '8px', overflow: 'hidden' }}>
                <span style={{ padding: '0 10px', fontSize: '13px', color: '#5B6472', fontWeight: 500, background: '#F6F7F9', borderRight: '1px solid #E7E9EE', height: '38px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{sym}</span>
                <input
                  type="number"
                  min={0}
                  value={montoPago}
                  onChange={e => setMontoPago(e.target.value)}
                  placeholder="0"
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '0 12px', height: '38px', fontSize: '15px', color: '#0B1220', background: 'transparent', minWidth: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
                />
              </div>
            </div>

            {/* Medio de pago */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', display: 'block', marginBottom: '5px' }}>Medio de pago</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {([
                  { value: 'efectivo' as const, label: 'Efectivo' },
                  { value: 'transferencia' as const, label: 'Transf.' },
                  { value: 'mercado_pago' as const, label: 'MP' },
                ]).map(opt => {
                  const sel = medioPago === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMedioPago(opt.value)}
                      style={{ padding: '8px', border: `1px solid ${sel ? '#0B1220' : '#E7E9EE'}`, borderRadius: '7px', background: sel ? '#0B1220' : '#FFFFFF', fontSize: '12px', fontWeight: 500, color: sel ? 'white' : '#1F2937', cursor: 'pointer' }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Preview distribución */}
            {previewSesiones.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8A93A1', margin: '0 0 6px' }}>Distribución:</p>
                <div style={{ border: '1px solid #E7E9EE', borderRadius: '8px', overflow: 'hidden' }}>
                  {previewSesiones.map((s, i) => {
                    const dt = new Date(new Date(s.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
                    const fechaStr = dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: i < previewSesiones.length - 1 ? '1px solid #E7E9EE' : 'none', fontSize: '12.5px' }}>
                        <span style={{ color: '#8A93A1', fontVariantNumeric: 'tabular-nums', width: '52px', flexShrink: 0 }}>{fechaStr}</span>
                        <span style={{ flex: 1, fontWeight: 600, color: s.resultado === 'pagado' ? '#047857' : '#B45309' }}>
                          {s.resultado === 'pagado' ? '✓ Saldada' : `Parcial +${sym} ${fmtNum(s.aplicado)}`}
                        </span>
                        <span style={{ fontSize: '11px', color: '#8A93A1' }}>{sym} {fmtNum((s.monto ?? 0) - (s.monto_pagado ?? 0))} saldo</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {pagoError && (
              <div style={{ marginBottom: '8px', padding: '8px 12px', background: '#FEE2E2', borderRadius: '8px', fontSize: '12.5px', color: '#DC2626' }}>
                {pagoError}
              </div>
            )}

            <button
              onClick={handlePagoACuenta}
              disabled={btnDisabled}
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: btnDisabled ? 'not-allowed' : 'pointer', border: 'none', background: btnDisabled ? '#F1F3F6' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: btnDisabled ? '#AEB5C0' : 'white', boxShadow: btnDisabled ? 'none' : '0 4px 10px rgba(37,99,235,0.20)' }}
            >
              {loadingPago ? 'Registrando...' : 'Registrar pago'}
            </button>
          </div>
        )}

        {/* Sessions section */}
        <div style={{ marginTop: '22px' }}>
          <h4 style={h4Style}>Sesiones con saldo</h4>

          {resumenEnviado && (
            <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#DCFCE7', borderRadius: '8px', fontSize: '12.5px', color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              Resumen del mes actual enviado correctamente
            </div>
          )}
          {resumenError && (
            <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#FEE2E2', borderRadius: '8px', fontSize: '12.5px', color: '#DC2626' }}>
              {resumenError}
            </div>
          )}

          {sesionesSinMonto.length > 0 && (
            <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '12px', color: '#92400E' }}>
              ⚠ {sesionesSinMonto.length} sesión{sesionesSinMonto.length !== 1 ? 'es' : ''} sin honorario asignado — no se incluyen en el total adeudado.
              <span style={{ display: 'block', marginTop: '2px', color: '#B45309' }}>
                Fechas: {sesionesSinMonto.map(s => {
                  const dt = new Date(new Date(s.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
                  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                }).join(', ')}
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#5B6472', fontSize: '13px' }}>Cargando...</div>
          ) : sesionesConMonto.length === 0 && sesionesSinMonto.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#8A93A1', fontSize: '13px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block' }}><path d="M20 6L9 17l-5-5"/></svg>
              Sin sesiones pendientes de cobro
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.values(sesionesPorMes).map(grupo => (
                <div key={grupo.label}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8A93A1', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #E7E9EE' }}>
                    {grupo.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {grupo.sesiones.map(s => {
                      const dt = new Date(new Date(s.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
                      const fechaStr = dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                      const horaStr = dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                      const estadoKey = s.estado_pago ?? 'pendiente'
                      const chip = STCHIP[estadoKey] ?? STCHIP.pendiente
                      const sSym = getCurrencySymbol(s.moneda)
                      const saldo = Math.max(0, (s.monto ?? 0) - (s.monto_pagado ?? 0))

                      return (
                        <div key={s.id}
                          style={{ display: 'grid', gridTemplateColumns: '56px 72px 1fr auto auto', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid #E7E9EE', borderRadius: '10px', background: '#FFFFFF', fontSize: '13px', transition: 'border-color .12s ease' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#D6DAE1')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '#E7E9EE')}
                        >
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{fechaStr}</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#8A93A1', fontVariantNumeric: 'tabular-nums' }}>{horaStr}</div>
                          <div style={{ fontSize: '12px', color: '#5B6472', minWidth: 0 }}>
                            <b style={{ color: '#1F2937', fontWeight: 600, fontSize: '13px', display: 'block' }}>{s.duracion_min} min</b>
                          </div>
                          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
                            {estadoKey === 'pago_parcial' ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#B45309' }}>
                                  <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sSym}</span>
                                  {fmtNum(saldo)}
                                  <span style={{ fontSize: '10px', color: '#8A93A1', fontWeight: 500, marginLeft: '3px' }}>pendiente</span>
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#8A93A1', marginTop: '1px' }}>
                                  de {sSym} {fmtNum(s.monto ?? 0)} · pag. {sSym} {fmtNum(s.monto_pagado ?? 0)}
                                </div>
                              </>
                            ) : s.monto != null ? (
                              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0B1220' }}>
                                <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sSym}</span>
                                {fmtNum(s.monto)}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#D97706' }}>⚠ Sin honorario</div>
                            )}
                          </div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 9px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', background: chip.bg, color: chip.color }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                            {chip.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </SlideOver>
  )
}
