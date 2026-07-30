'use client'

import { calcularPIOCorregida, clasificarPIO } from '@/lib/oftalmologia/calculos'
import type { IMCStatus } from '@/lib/nutricion/calculos'

interface Props {
  pioMedidaOd: number | null
  paquimetriaOd: number | null
  pioMedidaOi: number | null
  paquimetriaOi: number | null
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

function TarjetaPIO({ titulo, pioMedida, paquimetria }: { titulo: string; pioMedida: number | null; paquimetria: number | null }) {
  const pioCorregida = calcularPIOCorregida(pioMedida, paquimetria)
  const info = pioCorregida != null ? clasificarPIO(pioCorregida) : null

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{titulo}</div>
      {pioCorregida == null ? (
        <p style={placeholderStyle}>Completá PIO medida y paquimetría</p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink, #0B1220)', fontVariantNumeric: 'tabular-nums' }}>
            {pioCorregida.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-2, #8A93A1)' }}>mmHg</span>
          </span>
          {info && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none',
                fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                background: STATUS_COLORS[info.status].bg,
                color: STATUS_COLORS[info.status].fg,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
              {info.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function StickyWidgetPIO({ pioMedidaOd, paquimetriaOd, pioMedidaOi, paquimetriaOi }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TarjetaPIO titulo="PIO Corregida — OD" pioMedida={pioMedidaOd} paquimetria={paquimetriaOd} />
      <TarjetaPIO titulo="PIO Corregida — OI" pioMedida={pioMedidaOi} paquimetria={paquimetriaOi} />
      <p style={{ fontSize: 11, color: 'var(--muted-2, #8A93A1)', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>
        Valor orientativo (corrección de Ehlers) — no reemplaza el criterio clínico.
      </p>
    </div>
  )
}
