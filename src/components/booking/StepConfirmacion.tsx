'use client'

import type { ProfileData } from '@/app/p/[slug]/page'
import type { ConfirmacionData } from './BookingClient'
import { getTerminologia } from '@/hooks/useTerminologia'

interface DatosForm {
  nombre: string
  apellido: string
  email: string
  telefono: string
  coberturaId: string
}

interface Props {
  profile: ProfileData
  tipo: string
  fecha: string
  hora: string
  modalidad: string
  confirmacion: ConfirmacionData
  datosForm: DatosForm
}

// Deja solo dígitos y valida un largo razonable para un número con código de
// país (ej. 5491123456789 tiene 13). Sin librería externa — si no pasa, el
// botón de WhatsApp directamente no se renderiza, sin mensaje de error.
function telefonoWhatsappValido(telefono: string | null): string | null {
  if (!telefono) return null
  const limpio = telefono.replace(/\D/g, '')
  if (limpio.length < 10 || limpio.length > 15) return null
  return limpio
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

export default function StepConfirmacion({ profile, tipo, fecha, hora, modalidad, confirmacion, datosForm }: Props) {
  const t = getTerminologia(profile.terminologia)
  const tipoLabel = tipo === 'sesion' ? t.Sesion : 'Entrevista inicial'
  const modalidadLabel: Record<string, string> = { presencial: 'Presencial', videollamada: 'Online', telefonica: 'Telefónica' }

  const esMp = confirmacion.medio_pago === 'mp'
  const telefonoWa = telefonoWhatsappValido(profile.telefono)
  const waUrl = telefonoWa
    ? `https://wa.me/${telefonoWa}?text=${encodeURIComponent(
        `Hola ${profile.nombre}, te envío el comprobante de mi transferencia por el turno del ${formatFecha(fecha).toLowerCase()} a las ${hora} hs a nombre de ${datosForm.nombre} ${datosForm.apellido}.`
      )}`
    : null

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
          {esMp ? '¡Reserva confirmada!' : '¡Turno reservado!'}
        </h1>
        <p style={{ fontSize: 14, color: '#5B6472', margin: '0 0 24px', lineHeight: 1.6 }}>
          {esMp ? (
            <>Tu {tipoLabel.toLowerCase()} fue agendada y el pago procesado.<br /></>
          ) : (
            <>Tu {tipoLabel.toLowerCase()} fue agendada.<br /></>
          )}
          {esMp ? (
            'Te enviamos la confirmación a tu email.'
          ) : (
            'El profesional va a confirmar tu turno a la brevedad.'
          )}
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

        {/* Comprobante de transferencia */}
        {confirmacion.medio_pago === 'transferencia' && (profile.email || waUrl) && (
          <div style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 12,
            padding: '14px 16px',
            textAlign: 'left',
            marginBottom: 20,
          }}>
            {profile.email && (
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#92400E', lineHeight: 1.55 }}>
                Enviá el comprobante de tu transferencia a{' '}
                <strong>{profile.email}</strong>
                {profile.colaboradorasEmails.length > 0 && (
                  <> con copia a <strong>{profile.colaboradorasEmails.join(', ')}</strong></>
                )}
                .
              </p>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '10px 16px',
                  background: '#25D366',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 9,
                  fontSize: 13.5,
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.92-9.91-9.92zm0 18.15c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.27-4.4c0-4.54 3.7-8.24 8.24-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.27-8.24 8.27zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.41 1.02 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29z"/></svg>
                Enviar comprobante por WhatsApp
              </a>
            )}
          </div>
        )}

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
          {confirmacion.mp_payment_id && (
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
        {confirmacion.mp_payment_id && (
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
