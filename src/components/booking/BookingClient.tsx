'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ProfileData } from '@/app/p/[slug]/page'
import StepTipoConsulta from './StepTipoConsulta'
import StepCalendario from './StepCalendario'
import StepHorario from './StepHorario'
import StepDatos from './StepDatos'
import StepPago from './StepPago'
import StepConfirmacion from './StepConfirmacion'

export type ConfirmacionData = {
  turno_id: string
  mp_payment_id: string | null
  fecha_fmt: string
  hora: string
  duracion: number
  monto: number
  moneda: string
  referencia: string
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 'err-pay' | 'err-slot'

const STEP_NAMES = ['Profesional', 'Fecha', 'Hora', 'Datos', 'Pago']

interface Props {
  profile: ProfileData
}

export default function BookingClient({ profile }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [tipo, setTipo] = useState<'sesion' | 'entrevista'>('sesion')
  const [modalidad, setModalidad] = useState<string>(
    profile.booking_modalidades?.[0] ?? 'presencial'
  )
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null)
  const [selectedHora, setSelectedHora] = useState<string | null>(null)
  const [datosForm, setDatosForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
  })
  const [confirmacion, setConfirmacion] = useState<ConfirmacionData | null>(null)

  const showProgress = step !== 6 && step !== 'err-pay' && step !== 'err-slot'
  const stepNum = typeof step === 'number' ? step : 0

  function handleBack() {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
    else if (step === 4) setStep(3)
    else if (step === 5) setStep(4)
    else if (step === 'err-slot') setStep(2)
    else if (step === 'err-pay') setStep(4)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
          font-family: Inter, system-ui, -apple-system, sans-serif;
          background: #FAFBFC;
          min-height: 100vh;
        }
        @keyframes booking-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .booking-step-in {
          animation: booking-fade-up 0.28s ease both;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .bk-spinner {
          width: 36px; height: 36px;
          border: 3px solid #E7E9EE;
          border-top-color: #002d72;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      {/* Radial gradient background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 70% 40% at 10% 0%, rgba(37,99,235,0.07) 0%, transparent 70%),
          radial-gradient(ellipse 60% 40% at 90% 100%, rgba(0,26,72,0.06) 0%, transparent 70%)
        `,
      }} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E7E9EE',
          padding: '0 20px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <Image src="/logo.svg" alt="KLIA" width={75} height={30} priority style={{ height: 30, width: 'auto' }} />
        </header>

        {/* Progress bar */}
        {showProgress && (
          <div style={{
            background: '#fff',
            borderBottom: '1px solid #E7E9EE',
            padding: '0 20px',
          }}>
            <div style={{
              maxWidth: 540,
              margin: '0 auto',
              padding: '14px 0',
            }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {STEP_NAMES.map((_, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: stepNum > i + 1
                      ? '#001a48'
                      : stepNum === i + 1
                      ? '#2563EB'
                      : '#E7E9EE',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {STEP_NAMES.map((name, i) => (
                  <span key={i} style={{
                    fontSize: 10,
                    fontWeight: stepNum === i + 1 ? 600 : 400,
                    color: stepNum === i + 1 ? '#2563EB' : stepNum > i + 1 ? '#001a48' : '#AEB5C0',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main style={{
          flex: 1,
          maxWidth: 540,
          width: '100%',
          margin: '0 auto',
          padding: '24px 20px 40px',
        }}>
          {step === 1 && (
            <div key="step-1" className="booking-step-in">
              <StepTipoConsulta
                profile={profile}
                tipo={tipo}
                modalidad={modalidad}
                onTipo={setTipo}
                onModalidad={setModalidad}
                onNext={() => setStep(2)}
              />
            </div>
          )}

          {step === 2 && (
            <div key="step-2" className="booking-step-in">
              <StepCalendario
                tipo={tipo}
                slug={profile.booking_slug}
                selectedFecha={selectedFecha}
                onFecha={(f) => { setSelectedFecha(f); setSelectedHora(null) }}
                onNext={() => setStep(3)}
                onBack={handleBack}
              />
            </div>
          )}

          {step === 3 && selectedFecha && (
            <div key="step-3" className="booking-step-in">
              <StepHorario
                slug={profile.booking_slug}
                fecha={selectedFecha}
                tipo={tipo}
                selectedHora={selectedHora}
                onHora={setSelectedHora}
                onNext={() => setStep(4)}
                onBack={handleBack}
              />
            </div>
          )}

          {step === 4 && selectedFecha && selectedHora && (
            <div key="step-4" className="booking-step-in">
              <StepDatos
                profile={profile}
                tipo={tipo}
                fecha={selectedFecha}
                hora={selectedHora}
                modalidad={modalidad}
                form={datosForm}
                onForm={setDatosForm}
                onNext={() => setStep(5)}
                onBack={handleBack}
              />
            </div>
          )}

          {step === 5 && selectedFecha && selectedHora && (
            <div key="step-5" className="booking-step-in">
              <StepPago
                profile={profile}
                tipo={tipo}
                fecha={selectedFecha}
                hora={selectedHora}
                modalidad={modalidad}
                datosForm={datosForm}
                onConfirmacion={(conf) => {
                  setConfirmacion(conf)
                  setStep(6)
                }}
                onBack={handleBack}
                onErrPago={() => setStep('err-pay')}
                onErrSlot={() => setStep('err-slot')}
              />
            </div>
          )}

          {step === 6 && confirmacion && selectedFecha && selectedHora && (
            <div key="step-6" className="booking-step-in">
              <StepConfirmacion
                profile={profile}
                tipo={tipo}
                fecha={selectedFecha}
                hora={selectedHora}
                modalidad={modalidad}
                confirmacion={confirmacion}
              />
            </div>
          )}

          {step === 'err-slot' && (
            <div key="err-slot" className="booking-step-in">
              <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #E7E9EE',
                padding: '48px 32px',
                textAlign: 'center',
                boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 32,
                  background: '#FEF3C7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 28,
                }}>⚠️</div>
                <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#0B1220' }}>
                  Ese horario ya no está disponible
                </h2>
                <p style={{ margin: '0 0 28px', fontSize: 15, color: '#5B6472', lineHeight: 1.6 }}>
                  Otro paciente tomó ese turno mientras completabas el formulario. Por favor elegí otra fecha u horario.
                </p>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    background: '#001a48',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '13px 28px',
                    fontSize: 14.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxShadow: '0 6px 18px rgba(0,45,114,0.25)',
                  }}
                >
                  Elegir otra fecha
                </button>
              </div>
            </div>
          )}

          {step === 'err-pay' && (
            <div key="err-pay" className="booking-step-in">
              <div style={{
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #E7E9EE',
                padding: '48px 32px',
                textAlign: 'center',
                boxShadow: '0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04)',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 32,
                  background: '#FEE2E2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 28,
                }}>❌</div>
                <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#0B1220' }}>
                  El pago no pudo procesarse
                </h2>
                <p style={{ margin: '0 0 28px', fontSize: 15, color: '#5B6472', lineHeight: 1.6 }}>
                  Hubo un problema al procesar tu pago. Podés volver atrás e intentar nuevamente con otra tarjeta.
                </p>
                <button
                  onClick={() => setStep(4)}
                  style={{
                    background: '#001a48',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '13px 28px',
                    fontSize: 14.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    boxShadow: '0 6px 18px rgba(0,45,114,0.25)',
                  }}
                >
                  Intentar nuevamente
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{
          textAlign: 'center',
          padding: '20px 20px 32px',
          borderTop: '1px solid #E7E9EE',
          background: 'rgba(255,255,255,0.6)',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#AEB5C0' }}>
            © 2026 KLIA
            &nbsp;·&nbsp;
            <a href="https://klia.com.ar/terminos" target="_blank" rel="noopener noreferrer" style={{ color: '#8A93A1', textDecoration: 'none' }}>Términos</a>
            &nbsp;·&nbsp;
            <a href="https://klia.com.ar/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: '#8A93A1', textDecoration: 'none' }}>Privacidad</a>
          </p>
        </footer>
      </div>
    </>
  )
}
