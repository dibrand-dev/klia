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
  info: { bg: 'var(--blue-soft, #E8F0FE)', fg: 'var(--blue, #3B6FD6)' },
  success: { bg: 'var(--ok-soft, #E6F6EE)', fg: 'var(--ok, #16A34A)' },
  warning: { bg: 'var(--amber-soft, #FEF3E2)', fg: 'var(--amber-ink, #B45309)' },
  danger: { bg: 'var(--danger-soft, #FDECEC)', fg: 'var(--danger, #DC2626)' },
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border, #E7E9EE)',
  borderRadius: 'var(--r-lg, 12px)',
  padding: '16px',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted, #5B6472)',
  opacity: 0.6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
}

const placeholderStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--muted, #8A93A1)',
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* IMC */}
      <div style={cardStyle}>
        <div style={labelStyle}>IMC</div>
        {imc == null ? (
          <p style={placeholderStyle}>Completá peso y altura</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink, #0B1220)', lineHeight: 1 }}>
              {imc.toFixed(1)}
            </span>
            {imcInfo && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: STATUS_COLORS[imcInfo.status].bg,
                  color: STATUS_COLORS[imcInfo.status].fg,
                }}
              >
                {imcInfo.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* GEB */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ ...labelStyle, marginBottom: 0 }}>GEB</div>
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2, #F6F7F9)', borderRadius: 999, padding: 2 }}>
            <button
              type="button"
              onClick={() => setFormula('mifflin')}
              style={{
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: formula === 'mifflin' ? 'var(--surface, #fff)' : 'transparent',
                color: formula === 'mifflin' ? 'var(--ink, #0B1220)' : 'var(--muted, #8A93A1)',
                boxShadow: formula === 'mifflin' ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
              }}
            >
              Mifflin
            </button>
            <button
              type="button"
              onClick={() => setFormula('harris')}
              style={{
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: formula === 'harris' ? 'var(--surface, #fff)' : 'transparent',
                color: formula === 'harris' ? 'var(--ink, #0B1220)' : 'var(--muted, #8A93A1)',
                boxShadow: formula === 'harris' ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
              }}
            >
              Harris-Benedict
            </button>
          </div>
        </div>
        {geb == null ? (
          <p style={placeholderStyle}>Completá peso, altura, edad y sexo</p>
        ) : (
          <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink, #0B1220)' }}>
            {Math.round(geb).toLocaleString('es-AR')} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted, #5B6472)' }}>kcal/día</span>
          </span>
        )}
      </div>

      {/* Diferencia de peso */}
      <div style={cardStyle}>
        <div style={labelStyle}>Variación de peso</div>
        {loadingUltimo ? (
          <p style={placeholderStyle}>Cargando...</p>
        ) : !ultimoRegistro ? (
          <p style={placeholderStyle}>Primer registro para este paciente</p>
        ) : peso == null ? (
          <p style={placeholderStyle}>Completá el peso actual para comparar</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22 }}>
              {diffPeso === 0 ? '→' : diffPeso! > 0 ? '↑' : '↓'}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink, #0B1220)' }}>
              {Math.abs(diffPeso ?? 0).toFixed(1)} kg
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted, #8A93A1)' }}>
              vs. {new Date(ultimoRegistro.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
