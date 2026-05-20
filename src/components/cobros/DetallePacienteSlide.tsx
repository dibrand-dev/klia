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

interface Props {
  open: boolean
  onClose: () => void
  pacienteId: string | null
  pacienteNombre: string
  pacienteApellido: string
  osNombre: string | null
  terapeutaId: string
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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const STCHIP: Record<string, { bg: string; color: string; label: string }> = {
  pendiente:    { bg: '#FEE2E2', color: '#DC2626', label: 'Pendiente' },
  pagado:       { bg: '#DCFCE7', color: '#047857', label: 'Pagado' },
  pago_parcial: { bg: '#FEF3C7', color: '#B45309', label: 'Parcial' },
  bonificado:   { bg: '#F3F4F6', color: '#6b7280', label: 'Bonificada' },
}

export default function DetallePacienteSlide({ open, onClose, pacienteId, pacienteNombre, pacienteApellido, osNombre, terapeutaId }: Props) {
  const now = new Date()
  const argNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  const [mes, setMes] = useState(argNow.getUTCMonth())
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
    supabase.from('turnos')
      .select('id, fecha_hora, duracion_min, monto, moneda, estado_pago, monto_pagado')
      .eq('paciente_id', pacienteId)
      .eq('terapeuta_id', terapeutaId)
      .in('estado', ['realizado', 'no_asistio'])
      .gte('fecha_hora', inicioMes.toISOString())
      .lt('fecha_hora', finMes.toISOString())
      .order('fecha_hora')
      .then(({ data }) => { setSesiones((data ?? []) as SesionDetalle[]); setLoading(false) })
  }, [pacienteId, mes, anio, open, terapeutaId])

  useEffect(() => {
    setResumenEnviado(false)
    setResumenError(null)
  }, [pacienteId])

  if (!pacienteId) return null

  const monedaDefault = sesiones[0]?.moneda || 'ARS'
  const sym = getCurrencySymbol(monedaDefault)
  const totalMes = sesiones.reduce((acc, s) => acc + (s.estado_pago !== 'bonificado' ? (s.monto ?? 0) : 0), 0)
  const cobrado = sesiones.reduce((acc, s) => acc + (s.monto_pagado ?? 0), 0)
  const pendiente = Math.max(0, totalMes - cobrado)
  const promedio = sesiones.length > 0 ? Math.round(totalMes / sesiones.length) : 0
  const pctCobrado = totalMes > 0 ? Math.round((cobrado / totalMes) * 100) : 0
  const sesionesPendiente = sesiones.filter(s => (s.monto ?? 0) - (s.monto_pagado ?? 0) > 0 && s.estado_pago !== 'bonificado').length
  const countPagadas = sesiones.filter(s => s.estado_pago === 'pagado').length
  const countParciales = sesiones.filter(s => s.estado_pago === 'pago_parcial').length
  const countBonif = sesiones.filter(s => s.estado_pago === 'bonificado').length
  const countPendientes = sesiones.filter(s => s.estado_pago === 'pendiente').length

  const monthOptions: { mes: number; anio: number; label: string }[] = []
  for (let i = 0; i < 6; i++) {
    let m = argNow.getUTCMonth() - i, y = argNow.getUTCFullYear()
    if (m < 0) { m += 12; y -= 1 }
    monthOptions.push({ mes: m, anio: y, label: `${MESES[m].charAt(0).toUpperCase()}${MESES[m].slice(1)} ${y}` })
  }

  const mesLabel = `${MESES[mes].charAt(0).toUpperCase()}${MESES[mes].slice(1)} ${anio}`
  const av = getAvatarStyle(`${pacienteNombre}${pacienteApellido}`)

  async function handleEnviarResumen() {
    if (!pacienteId) return
    setEnviandoResumen(true); setResumenError(null)
    try {
      const res = await fetch('/api/cobros/resumen-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paciente_id: pacienteId, mes: mes + 1, anio }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      setResumenEnviado(true)
    } catch (err) {
      setResumenError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setEnviandoResumen(false)
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
        <div style={{ fontSize: '12px', color: '#5B6472', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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

  return (
    <SlideOver open={open} onClose={onClose} title="" header={soHeader} footer={soFooter} noPadding width="md">
      <div style={{ padding: '20px 22px' }}>

        <h4 style={h4Style}>Resumen del mes · {mesLabel}</h4>

        {/* Stat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          {/* Sesiones */}
          <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A93A1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Sesiones
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: '#0B1220' }}>{sesiones.length}</div>
            <div style={{ fontSize: '11px', color: '#5B6472', marginTop: '3px' }}>
              {[countPagadas > 0 && `${countPagadas} pagada${countPagadas !== 1 ? 's' : ''}`, countParciales > 0 && `${countParciales} parciale${countParciales !== 1 ? 's' : ''}`, countBonif > 0 && `${countBonif} bonificada${countBonif !== 1 ? 's' : ''}`, countPendientes > 0 && `${countPendientes} pendiente${countPendientes !== 1 ? 's' : ''}`].filter(Boolean).join(' · ') || 'Sin sesiones'}
            </div>
          </div>
          {/* Total del mes */}
          <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A93A1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Total del mes
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: '#0B1220' }}>
              <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>{fmtNum(totalMes)}
              <span style={{ fontSize: '13px', color: '#5B6472', marginLeft: '4px' }}>{monedaDefault}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#5B6472', marginTop: '3px' }}>{sym} {fmtNum(promedio)} promedio por sesión</div>
          </div>
          {/* Cobrado */}
          <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Cobrado
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: '#047857' }}>
              <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>{fmtNum(cobrado)}
            </div>
            <div style={{ fontSize: '11px', color: '#10b981', marginTop: '3px' }}>{pctCobrado}% del total</div>
          </div>
          {/* Pendiente */}
          <div style={{ background: '#F6F7F9', border: '1px solid #E7E9EE', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Pendiente
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: '#DC2626' }}>
              <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sym}</span>{fmtNum(pendiente)}
            </div>
            <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '3px' }}>{sesionesPendiente} sesión{sesionesPendiente !== 1 ? 'es' : ''} con saldo</div>
          </div>
        </div>

        {/* Sessions section */}
        <div style={{ marginTop: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <h4 style={{ ...h4Style, margin: 0 }}>Sesiones del período</h4>
            <select
              value={`${mes}-${anio}`}
              onChange={e => { const [m, y] = e.target.value.split('-').map(Number); setMes(m); setAnio(y) }}
              style={{ marginLeft: 'auto', border: '1px solid #E7E9EE', borderRadius: '7px', padding: '5px 10px', fontSize: '13px', background: '#FFFFFF', color: '#0B1220', outline: 'none' }}
            >
              {monthOptions.map(o => (
                <option key={`${o.mes}-${o.anio}`} value={`${o.mes}-${o.anio}`}>{o.label}</option>
              ))}
            </select>
          </div>

          {resumenEnviado && (
            <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#DCFCE7', borderRadius: '8px', fontSize: '12.5px', color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              Resumen enviado correctamente
            </div>
          )}
          {resumenError && (
            <div style={{ marginBottom: '10px', padding: '10px 12px', background: '#FEE2E2', borderRadius: '8px', fontSize: '12.5px', color: '#DC2626' }}>
              {resumenError}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#5B6472', fontSize: '13px' }}>Cargando...</div>
          ) : sesiones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#8A93A1', fontSize: '13px' }}>Sin sesiones en este período</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sesiones.map(s => {
                const dt = new Date(s.fecha_hora)
                const dtArg = new Date(dt.getTime() - 3 * 60 * 60 * 1000)
                const fechaStr = dtArg.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                const horaStr = dtArg.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                const estadoKey = s.estado_pago ?? 'pendiente'
                const chip = STCHIP[estadoKey] ?? STCHIP.pendiente
                const isBonif = estadoKey === 'bonificado'
                const sSym = getCurrencySymbol(s.moneda)
                const sPaid = s.monto_pagado ?? 0
                const infoSub = estadoKey === 'pago_parcial'
                  ? `${sSym} ${fmtNum(sPaid)} pagados`
                  : isBonif ? 'Cortesía' : `${s.duracion_min} min`

                return (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '56px 80px 1fr auto auto', alignItems: 'center', gap: '12px', padding: '10px 12px', border: '1px solid #E7E9EE', borderRadius: '10px', background: '#FFFFFF', fontSize: '13px', transition: 'border-color .12s ease' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#D6DAE1')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E7E9EE')}
                  >
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{fechaStr}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11.5px', color: '#8A93A1', fontVariantNumeric: 'tabular-nums' }}>{horaStr}</div>
                    <div style={{ fontSize: '12px', color: '#5B6472', minWidth: 0 }}>
                      <b style={{ color: '#1F2937', fontWeight: 600, fontSize: '13px', display: 'block' }}>{s.duracion_min} min</b>
                      {infoSub}
                    </div>
                    <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: '13.5px', color: isBonif ? '#5B6472' : '#0B1220', textDecoration: isBonif ? 'line-through' : 'none' }}>
                      <span style={{ fontSize: '11px', color: '#8A93A1', fontWeight: 500, marginRight: '2px' }}>{sSym}</span>
                      {s.monto != null ? fmtNum(s.monto) : '—'}
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 9px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', background: chip.bg, color: chip.color }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                      {chip.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </SlideOver>
  )
}
