'use client'

import type { SedePublica } from '@/app/p/[slug]/page'

interface Props {
  sede: SedePublica
  onCambiar: () => void
}

// Réplica de .sede-ctx del diseño real (Link Reserva Publica.html) — breadcrumb
// de sede visible en Fecha/Hora, con borde izquierdo del color de la sede.
export default function SedeBreadcrumb({ sede, onCambiar }: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${sede.color || 'var(--navy)'}`,
      borderRadius: 12, padding: '10px 12px',
      marginBottom: 14, boxShadow: 'var(--shadow-sm)',
    }}>
      <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: sede.color || 'var(--navy)', strokeWidth: 1.8, fill: 'none', flexShrink: 0 }}>
        {sede.es_online ? (
          <><rect x="2.5" y="6.5" width="12" height="11" rx="2" /><path d="M14.5 11l7-3.5v9l-7-3.5z" /></>
        ) : (
          <><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>
        )}
      </svg>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
        <b style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {sede.nombre}
        </b>
        <span style={{
          display: 'block', fontSize: 11.5, color: 'var(--muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {sede.es_online ? 'Videoconsulta' : (sede.direccion || 'Presencial')}
        </span>
      </div>
      <button
        onClick={onCambiar}
        style={{
          flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--blue)', fontSize: 12.5, fontWeight: 600,
          padding: '6px 2px 6px 8px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        Cambiar
      </button>
    </div>
  )
}
