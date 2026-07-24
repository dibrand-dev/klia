'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcularIMC, clasificarIMC, calcularGEB, type FormulaGEB, type IMCStatus } from '@/lib/nutricion/calculos'

interface Props {
  pacienteId: string
  peso: number | null
  altura: number | null
  edad: number | null
  sexo: 'M' | 'F' | null
  registroEnEdicionId?: string | null
}

const STATUS_COLORS: Record<IMCStatus, { bg: string; fg: string }> = {
  info: { bg: 'var(--status-info-soft, #EAF0FE)', fg: 'var(--status-info, #1F4FD9)' },
  success: { bg: 'var(--status-success-soft, #E7F5EE)', fg: 'var(--status-success, #0E8A5F)' },
  warning: { bg: 'var(--status-warning-soft, #FBF1E2)', fg: '#B45309' },
  danger: { bg: 'var(--status-danger-soft, #FBECEA)', fg: 'var(--status-danger, #B42318)' },
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border, #E7E9EE)',
  borderRadius: 'var(--r-md, 10px)',
  padding: '12px 14px',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: 'var(--muted-2, #8A93A1)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 6,
}

const placeholderStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--muted-2, #8A93A1)',
  fontStyle: 'italic',
}

export default function StickyWidgetAntropometria({ pacienteId, peso, altura, edad, sexo, registroEnEdicionId }: Props) {
  const [formula, setFormula] = useState<FormulaGEB>('mifflin')
  const [ultimoRegistro, setUltimoRegistro] = useState<{ peso: number | null; fecha: string } | null>(null)
  const [loadingUltimo, setLoadingUltimo] = useState(true)

  useEffect(() => {
    let cancelado = false
    async function fetchUltimo() {
      setLoadingUltimo(true)
      const supabase = createClient()
      let query = supabase
        .from('registros_antropometricos')
        .select('peso, fecha')
        .eq('paciente_id', pacienteId)
        .order('fecha', { ascending: false })
        .limit(1)
      if (registroEnEdicionId) query = query.neq('id', registroEnEdicionId)
      const { data } = await query.maybeSingle()
      if (cancelado) return
      setUltimoRegistro(data ? { peso: data.peso, fecha: data.fecha } : null)
      setLoadingUltimo(false)
    }
    if (pacienteId) fetchUltimo()
    return () => { cancelado = true }
  }, [pacienteId, registroEnEdicionId])

  const imc = calcularIMC(peso, altura)
  const imcInfo = imc != null ? clasificarIMC(imc) : null
  const geb = calcularGEB(peso, altura, edad, sexo, formula)

  const diffPeso = peso != null && ultimoRegistro?.peso != null ? peso - ultimoRegistro.peso : null

  const diffIconVariant = diffPeso == null || diffPeso === 0 ? 'flat' : diffPeso > 0 ? 'up' : 'down'
  const DIFF_ICON_COLORS: Record<'up' | 'down' | 'flat', { bg: string; fg: string }> = {
    up: { bg: 'var(--status-danger-soft, #FBECEA)', fg: 'var(--status-danger, #B42318)' },
    down: { bg: 'var(--status-success-soft, #E7F5EE)', fg: 'var(--status-success, #0E8A5F)' },
    flat: { bg: 'var(--surface-3, #F1F3F6)', fg: 'var(--muted, #5B6472)' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* IMC */}
      <div style={cardStyle}>
        <div style={labelStyle}>IMC</div>
        {imc == null ? (
          <p style={placeholderStyle}>Completá peso y altura</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink, #0B1220)', fontVariantNumeric: 'tabular-nums' }}>
              {imc.toFixed(1)}
            </span>
            {imcInfo && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none',
                  fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                  background: STATUS_COLORS[imcInfo.status].bg,
                  color: STATUS_COLORS[imcInfo.status].fg,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                {imcInfo.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* GEB */}
      <div style={cardStyle}>
        <div style={labelStyle}>Gasto energético basal (GEB)</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          {geb == null ? (
            <p style={placeholderStyle}>Completá peso, altura, edad y sexo</p>
          ) : (
            <span style={{ fontSize: 21, fontWeight: 700, color: 'var(--ink, #0B1220)', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(geb).toLocaleString('es-AR')} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-2, #8A93A1)', marginLeft: 3 }}>kcal/día</span>
            </span>
          )}
        </div>
        <div style={{ display: 'inline-flex', marginTop: 9, padding: 2, width: '100%', background: 'var(--surface-2, #F6F7F9)', border: '1px solid var(--border, #E7E9EE)', borderRadius: 7, gap: 2 }}>
          <button
            type="button"
            onClick={() => setFormula('mifflin')}
            style={{
              flex: 1, fontSize: 10.5, fontWeight: 600, padding: '5px 6px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: formula === 'mifflin' ? 'var(--ink, #0B1220)' : 'transparent',
              color: formula === 'mifflin' ? '#fff' : 'var(--muted, #5B6472)',
              transition: 'all .12s ease',
            }}
          >
            Mifflin-St Jeor
          </button>
          <button
            type="button"
            onClick={() => setFormula('harris')}
            style={{
              flex: 1, fontSize: 10.5, fontWeight: 600, padding: '5px 6px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: formula === 'harris' ? 'var(--ink, #0B1220)' : 'transparent',
              color: formula === 'harris' ? '#fff' : 'var(--muted, #5B6472)',
              transition: 'all .12s ease',
            }}
          >
            Harris-Benedict
          </button>
        </div>
      </div>

      {/* Diferencia de peso */}
      <div style={cardStyle}>
        <div style={labelStyle}>Peso vs. última consulta</div>
        {loadingUltimo ? (
          <p style={placeholderStyle}>Cargando...</p>
        ) : !ultimoRegistro ? (
          <p style={placeholderStyle}>Primer registro para este paciente</p>
        ) : peso == null ? (
          <p style={placeholderStyle}>Completá el peso actual para comparar</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center',
                background: DIFF_ICON_COLORS[diffIconVariant].bg,
                color: DIFF_ICON_COLORS[diffIconVariant].fg,
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, strokeWidth: 2.2, fill: 'none', stroke: 'currentColor' }}>
                {diffIconVariant === 'flat' && <path d="M5 12h14" />}
                {diffIconVariant === 'up' && <path d="M12 19V5M5 12l7-7 7 7" />}
                {diffIconVariant === 'down' && <path d="M12 5v14M5 12l7 7 7-7" />}
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink, #0B1220)', fontVariantNumeric: 'tabular-nums' }}>
                {diffPeso === 0 ? '→' : diffPeso! > 0 ? '↑' : '↓'} {Math.abs(diffPeso ?? 0).toFixed(1)} kg
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-2, #8A93A1)', marginTop: 1 }}>
                vs. {new Date(ultimoRegistro.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
