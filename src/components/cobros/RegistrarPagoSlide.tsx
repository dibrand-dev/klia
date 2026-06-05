'use client'

import { useEffect, useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
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

const MEDIO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
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

function todayArgStr() {
  return new Date(new Date().getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

interface Props {
  open: boolean
  onClose: () => void
  turno: TurnoDeuda | null
  onSuccess: () => void
}

export default function RegistrarPagoSlide({ open, onClose, turno, onSuccess }: Props) {
  const saldo = turno ? Math.max(0, (turno.monto ?? 0) - (turno.monto_pagado ?? 0)) : 0

  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState<'efectivo' | 'transferencia' | 'mercado_pago'>('transferencia')
  const [fechaCobro, setFechaCobro] = useState(todayArgStr())
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historial, setHistorial] = useState<Cobro[]>([])
  const [confirmEliminarCobro, setConfirmEliminarCobro] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    if (!turno) return
    setMonto(String(saldo))
    setMedioPago('transferencia')
    setFechaCobro(todayArgStr())
    setNotas('')
    setError(null)
    setLoading(false)
    const supabase = createClient()
    supabase.from('cobros').select('*').eq('turno_id', turno.id).order('fecha_cobro', { ascending: false })
      .then(({ data }) => setHistorial(data ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno?.id])

  if (!turno) return null

  const montoNum = parseFloat(monto) || 0
  const quedaPagada = montoNum >= saldo
  const nuevoSaldo = Math.max(0, saldo - montoNum)
  const sym = getCurrencySymbol(turno.moneda)

  const dt = new Date(turno.fecha_hora)
  const dtArg = new Date(dt.getTime() - 3 * 60 * 60 * 1000)
  const fechaStr = dtArg.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  const horaStr = dtArg.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const av = getAvatarStyle(`${turno.paciente_nombre}${turno.paciente_apellido}`)

  async function handleEliminarCobro(cobroId: string) {
    setEliminando(true)
    try {
      const res = await fetch('/api/cobros/eliminar-cobro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cobro_id: cobroId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar cobro')
      setHistorial(prev => prev.filter(c => c.id !== cobroId))
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar cobro')
    } finally {
      setEliminando(false)
      setConfirmEliminarCobro(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turno) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/cobros/registrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turno_id: turno.id, monto_cobrado: montoNum, medio_pago: medioPago, fecha_cobro: fechaCobro, notas: notas || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al registrar cobro')
      onSuccess(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const soHeader = (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #E7E9EE', display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'linear-gradient(180deg, #F4F7FE 0%, transparent 100%)', flexShrink: 0 }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: av.bg, color: av.color, display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: '16px', letterSpacing: '-0.02em' }}>
        {turno.paciente_nombre[0]}{turno.paciente_apellido[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#0B1220', letterSpacing: '-0.015em' }}>
          {turno.paciente_nombre} {turno.paciente_apellido}
        </div>
        <div style={{ fontSize: '12px', color: '#5B6472', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span>{fechaStr}</span>
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#AEB5C0', flexShrink: 0 }} />
          <span>{horaStr}</span>
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#AEB5C0', flexShrink: 0 }} />
          <span>{turno.duracion_min} min</span>
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
        type="button"
        onClick={onClose}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', border: '1px solid #E7E9EE', background: '#FFFFFF', color: '#1F2937' }}
      >
        Cancelar
      </button>
      <button
        form="registrar-pago-form"
        type="submit"
        disabled={loading || montoNum <= 0}
        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: loading || montoNum <= 0 ? 'not-allowed' : 'pointer', border: 'none', background: loading || montoNum <= 0 ? '#F1F3F6' : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: loading || montoNum <= 0 ? '#AEB5C0' : 'white', boxShadow: loading || montoNum <= 0 ? 'none' : '0 4px 10px rgba(37,99,235,0.20)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
        {loading ? 'Registrando...' : 'Registrar cobro'}
      </button>
    </div>
  )

  const h4Style: React.CSSProperties = { margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8A93A1' }
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }
  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#1F2937' }

  return (
    <>
    <SlideOver open={open} onClose={onClose} title="" header={soHeader} footer={soFooter} noPadding width="md">
      <form id="registrar-pago-form" onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>

        <h4 style={h4Style}>Resumen de la sesión</h4>
        <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>
            <span>Monto total</span>
            <span><span style={{ fontSize: '11.5px', opacity: 0.7, fontWeight: 500, marginRight: '3px' }}>{sym}</span>{fmtNum(turno.monto)} {turno.moneda}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: '#1F2937' }}>Ya registrado como pagado</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}><span style={{ fontSize: '11.5px', opacity: 0.7, fontWeight: 500, marginRight: '3px' }}>{sym}</span>{fmtNum(turno.monto_pagado)} {turno.moneda}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontVariantNumeric: 'tabular-nums', paddingTop: '8px', borderTop: '1px dashed #E7E9EE', fontWeight: 700, color: '#DC2626', fontSize: '15px' }}>
            <span>Saldo pendiente</span>
            <span style={{ background: '#FEE2E2', padding: '4px 10px', borderRadius: '6px' }}>
              <span style={{ fontSize: '11.5px', opacity: 0.7, fontWeight: 500, marginRight: '3px' }}>{sym}</span>{fmtNum(saldo)} {turno.moneda}
            </span>
          </div>
        </div>

        <div style={{ marginTop: '22px' }}>
          <h4 style={h4Style}>Registrar nuevo cobro</h4>

          <div style={fieldStyle}>
            <label style={labelStyle}>Monto cobrado <em style={{ color: '#DC2626', fontStyle: 'normal', fontWeight: 700, marginLeft: '2px' }}>*</em></label>
            <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E7E9EE', borderRadius: '8px', overflow: 'hidden' }}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <span style={{ padding: '0 10px', fontSize: '13px', color: '#5B6472', fontWeight: 500, background: '#F6F7F9', borderRight: '1px solid #E7E9EE', height: '38px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{sym}</span>
              <input
                type="number"
                min={0}
                step="any"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                inputMode="numeric"
                required
                style={{ flex: 1, border: 'none', outline: 'none', padding: '0 12px', height: '38px', fontSize: '15px', color: '#0B1220', background: 'transparent', minWidth: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
              />
              <span style={{ padding: '0 10px', fontSize: '13px', color: '#5B6472', fontWeight: 500, background: '#F6F7F9', borderLeft: '1px solid #E7E9EE', height: '38px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{turno.moneda}</span>
            </div>
            <span style={{ fontSize: '11.5px', color: '#8A93A1' }}>El saldo pendiente ya está precargado. Podés editarlo si es un pago parcial.</span>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Medio de pago <em style={{ color: '#DC2626', fontStyle: 'normal', fontWeight: 700, marginLeft: '2px' }}>*</em></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {([
                { value: 'efectivo' as const, label: 'Efectivo', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg> },
                { value: 'transferencia' as const, label: 'Transferencia', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h13l-3-3M21 17H8l3 3"/></svg> },
                { value: 'mercado_pago' as const, label: 'Mercado Pago', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg> },
              ]).map(opt => {
                const sel = medioPago === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMedioPago(opt.value)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', border: `1px solid ${sel ? '#0B1220' : '#E7E9EE'}`, borderRadius: '8px', background: sel ? '#0B1220' : '#FFFFFF', fontSize: '13px', fontWeight: 500, color: sel ? 'white' : '#1F2937', cursor: 'pointer', transition: 'all .12s ease' }}
                  >
                    <span style={{ color: sel ? 'white' : '#5B6472', display: 'flex' }}>{opt.icon}</span>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Fecha de cobro <em style={{ color: '#DC2626', fontStyle: 'normal', fontWeight: 700, marginLeft: '2px' }}>*</em></label>
            <input
              type="date"
              value={fechaCobro}
              onChange={e => setFechaCobro(e.target.value)}
              style={{ border: '1px solid #E7E9EE', borderRadius: '8px', padding: '0 12px', height: '38px', fontSize: '14px', color: '#0B1220', outline: 'none', fontVariantNumeric: 'tabular-nums', width: '100%' }}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Notas <span style={{ color: '#8A93A1', fontWeight: 500 }}>(opcional)</span></label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Comprobante, observaciones…"
              style={{ border: '1px solid #E7E9EE', borderRadius: '8px', padding: '10px 12px', fontSize: '13.5px', color: '#0B1220', resize: 'vertical', minHeight: '64px', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          {montoNum > 0 && (
            <div style={{ marginTop: '4px', padding: '10px 12px', background: quedaPagada ? '#DCFCE7' : '#FEF3C7', borderRadius: '8px', fontSize: '12.5px', color: quedaPagada ? '#047857' : '#B45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {quedaPagada ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                  Tras registrar, esta sesión quedará marcada como <b>Pagada</b>.</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/></svg>
                  Tras registrar, esta sesión quedará como <b>Pago parcial</b>. Saldo: {sym} {fmtNum(nuevoSaldo)}.</>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: '10px', padding: '10px 12px', background: '#FEE2E2', borderRadius: '8px', fontSize: '13px', color: '#DC2626' }}>
              {error}
            </div>
          )}
        </div>

        {historial.length > 0 && (
          <div style={{ marginTop: '22px' }}>
            <h4 style={h4Style}>Historial de cobros previos</h4>
            <div style={{ border: '1px solid #E7E9EE', borderRadius: '10px', overflow: 'hidden' }}>
              {historial.map((c, i) => {
                const d = new Date(c.fecha_cobro)
                const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: i < historial.length - 1 ? '1px solid #E7E9EE' : 'none', fontSize: '13px' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#8A93A1', width: '88px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</span>
                    <span style={{ flex: 1, fontWeight: 600, color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>
                      {fmtNum(c.monto_cobrado)} {c.moneda}
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#5B6472', padding: '2px 8px', borderRadius: '100px', background: '#F6F7F9' }}>
                      {MEDIO_LABELS[c.medio_pago] ?? c.medio_pago}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmEliminarCobro(c.id)}
                      title="Eliminar cobro"
                      style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #FCA5A5', background: '#FEF2F2', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </form>
    </SlideOver>

    <ConfirmDialog
      open={!!confirmEliminarCobro}
      title="Eliminar cobro"
      message="¿Estás seguro que querés eliminar este cobro? Esta acción actualizará el saldo pendiente de la sesión."
      confirmLabel={eliminando ? 'Eliminando...' : 'Eliminar'}
      cancelLabel="Cancelar"
      variant="danger"
      onConfirm={() => confirmEliminarCobro && handleEliminarCobro(confirmEliminarCobro)}
      onCancel={() => setConfirmEliminarCobro(null)}
    />
    </>
  )
}
