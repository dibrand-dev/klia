'use client'

import type { ProfileData } from '@/app/p/[slug]/page'
import type { ConfirmacionData } from './BookingClient'
import { getTerminologia } from '@/hooks/useTerminologia'

interface Props {
  profile: ProfileData
  tipo: string
  fecha: string
  hora: string
  modalidad: string
  confirmacion: ConfirmacionData
}

function formatFecha(fechaStr: string): string {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function buildGCalUrl(params: { title: string; start: string; end: string; details: string }): string {
  const fmt = (s: string) => s.replace(/[-:]/g, '').replace('.000Z', 'Z')
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${fmt(params.start)}/${fmt(params.end)}`,
    details: params.details,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

export default function StepConfirmacion({ profile, tipo, fecha, hora, modalidad, confirmacion }: Props) {
  const t = getTerminologia(profile.terminologia)
  const tipoLabel = tipo === 'sesion' ? t.Sesion : 'Entrevista inicial'
  const modalidadLabel: Record<string, string> = { presencial: 'Presencial', videollamada: 'Online', telefonica: 'Telefónica' }

  const gCalUrl = (() => {
    const [y, m, d] = fecha.split('-').map(Number)
    const [h, min] = hora.split(':').map(Number)
    const start = new Date(y, m - 1, d, h, min)
    const end = new Date(start.getTime() + confirmacion.duracion * 60000)
    return buildGCalUrl({
      title: `${tipoLabel} con ${profile.nombre} ${profile.apellido}`,
      start: start.toISOString(),
      end: end.toISOString(),
      details: `${tipoLabel} de ${confirmacion.duracion} min · ${modalidadLabel[modalidad] ?? modalidad}`,
    })
  })()

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.3; }
          100% { transform: scale(1.2); opacity: 0; }
        }
      `}</style>

      <div style={{
        background: '#fff',
        border: '1px solid #E7E9EE',
        borderRadius: 16,
        padding: '32px 26px 26px',
        textAlign: 'center',
        boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
        marginBottom: 18,
      }}>
        {/* Success icon */}
        <div style={{ position: 'relative', width: 78, height: 78, margin: '0 auto 24px' }}>
          <div style={{
            position: 'absolute', inset: -10,
            border: '2px solid #10b981',
            borderRadius: '50%',
            opacity: 0.2,
            animation: 'pulse-ring 2s ease-out infinite',
          }} />
          <div style={{
            width: 78, height: 78, borderRadius: '50%',
            background: 'linear-gradient(145deg, #DCFCE7, #BBF7D0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 30px rgba(16,185,129,0.25)',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#0B1220', margin: '0 0 8px' }}>
          ¡Reserva confirmada!
        </h1>
        <p style={{ fontSize: 14, color: '#5B6472', margin: '0 0 24px', lineHeight: 1.6 }}>
          Tu {tipoLabel.toLowerCase()} fue agendada y el pago procesado.<br />
          Te enviamos la confirmación a tu email.
        </p>

        {/* Detail */}
        <div style={{
          background: '#F6F7F9',
          borderRadius: 12,
          padding: '14px 16px',
          textAlign: 'left',
          marginBottom: 20,
        }}>
          {[
            { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A93A1" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>, text: <span><strong style={{ color: '#0B1220' }}>{profile.nombre} {profile.apellido}</strong> te espera</span> },
            { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A93A1" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>, text: <span style={{ color: '#1F2937' }}>{formatFecha(fecha)}</span> },
            { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A93A1" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>, text: <span style={{ color: '#1F2937' }}><strong style={{ color: '#0B1220' }}>{hora} hs</strong> · {confirmacion.duracion} min · {modalidadLabel[modalidad] ?? modalidad}</span> },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 13.5, color: '#1F2937' }}>
              <span style={{ flexShrink: 0 }}>{row.icon}</span>
              {row.text}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href={gCalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 16px',
              background: '#0B1220',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M12 14v4M10 16h4"/></svg>
            Agregar a Google Calendar
          </a>
          {confirmacion.referencia && (
            <a
              href={`/api/booking/comprobante?ref=${confirmacion.referencia}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 16px',
                background: 'transparent',
                color: '#5B6472',
                border: '1px solid #E7E9EE',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar comprobante de pago
            </a>
          )}
        </div>

        {/* Reference */}
        {(confirmacion.mp_payment_id || confirmacion.referencia) && (
          <div style={{
            marginTop: 20,
            padding: '12px 14px',
            background: '#F4F7FF',
            borderRadius: 10,
            fontSize: 12,
            color: '#1F2937',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
            <div>
              <strong style={{ fontWeight: 600 }}>Referencia del pago</strong>
              <div style={{ color: '#5B6472', marginTop: 2 }}>Mercado Pago</div>
              {confirmacion.referencia && (
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11.5,
                  color: '#5B6472',
                  background: 'rgba(255,255,255,0.7)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  marginTop: 4,
                  display: 'inline-block',
                }}>
                  {confirmacion.referencia}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
