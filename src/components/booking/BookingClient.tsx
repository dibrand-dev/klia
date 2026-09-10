'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ProfileData, SedePublica } from '@/app/p/[slug]/page'
import StepTipoConsulta from './StepTipoConsulta'
import StepSede from './StepSede'
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
  medio_pago: 'mp' | 'transferencia' | 'sin_costo'
}

type StepKey = 'tipo' | 'sede' | 'fecha' | 'hora' | 'datos' | 'pago'
type Step = StepKey | 'confirmacion' | 'err-pay' | 'err-slot'

const STEP_NAMES: Record<StepKey, string> = {
  tipo: 'Profesional',
  sede: 'Sede',
  fecha: 'Fecha',
  hora: 'Hora',
  datos: 'Datos',
  pago: 'Pago',
}

interface Props {
  profile: ProfileData
}

export default function BookingClient({ profile }: Props) {
  const multiSede = profile.sedes.length > 1

  // Fuente única de orden/cantidad/nombres de pasos — 'sede' se inserta solo
  // cuando hay 2+ sedes activas, nunca reemplaza a los demás pasos.
  const STEPS: StepKey[] = multiSede
    ? ['tipo', 'sede', 'fecha', 'hora', 'datos', 'pago']
    : ['tipo', 'fecha', 'hora', 'datos', 'pago']

  const [step, setStep] = useState<Step>('tipo')
  const [tipo, setTipo] = useState<'sesion' | 'entrevista'>('sesion')
  const [modalidad, setModalidad] = useState<string>(
    profile.booking_modalidades?.[0] ?? 'presencial'
  )
  const [sede, setSede] = useState<SedePublica | null>(null)
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null)
  const [selectedHora, setSelectedHora] = useState<string | null>(null)
  const [datosForm, setDatosForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    coberturaId: '',
  })
  const [confirmacion, setConfirmacion] = useState<ConfirmacionData | null>(null)

  const stepIdx = STEPS.indexOf(step as StepKey)
  const showProgress = stepIdx >= 0
  const stepNum = stepIdx + 1

  function goToKey(key: StepKey) {
    setStep(key)
  }

  function goNextFrom(key: StepKey) {
    const idx = STEPS.indexOf(key)
    const next = STEPS[idx + 1]
    if (next) setStep(next)
  }

  function goBackFrom(key: StepKey) {
    const idx = STEPS.indexOf(key)
    const prev = STEPS[idx - 1]
    if (prev) setStep(prev)
  }

  function handleBack() {
    if (step === 'err-slot') {
      goToKey('fecha')
    } else if (step === 'err-pay') {
      goToKey('datos')
    } else if (step !== 'tipo' && step !== 'confirmacion') {
      goBackFrom(step as StepKey)
    }
  }

  function handleSede(s: SedePublica) {
    setSede(s)
    setModalidad(s.es_online ? 'videollamada' : 'presencial')
    goNextFrom('sede')
  }

  function handleCambiarSede() {
    goToKey('sede')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        :root {
          --bg: #FAFBFC;
          --surface: #FFFFFF;
          --surface-2: #F6F7F9;
          --surface-3: #F1F3F6;
          --border: #E7E9EE;
          --border-strong: #D6DAE1;
          --ink: #0B1220;
          --ink-2: #1F2937;
          --muted: #5B6472;
          --muted-2: #8A93A1;
          --muted-3: #AEB5C0;
          --navy: #001a48;
          --navy-2: #002d72;
          --blue: #2563EB;
          --blue-soft: #EFF4FF;
          --blue-soft-2: #F4F7FF;
          --green: #10b981;
          --green-soft: #DCFCE7;
          --green-ink: #047857;
          --amber: #f59e0b;
          --amber-soft: #FEF3C7;
          --red: #DC2626;
          --red-soft: #FEE2E2;
          --shadow-sm: 0 1px 0 rgba(16,24,40,.02), 0 1px 2px rgba(16,24,40,.04);
          --shadow-md: 0 2px 4px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06);
          --shadow-lg: 0 8px 24px rgba(16,24,40,.08), 0 24px 64px rgba(16,24,40,.10);
        }
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
                {STEPS.map((_, i) => (
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
                {STEPS.map((key, i) => (
                  <span key={key} style={{
                    fontSize: 10,
                    fontWeight: stepNum === i + 1 ? 600 : 400,
                    color: stepNum === i + 1 ? '#2563EB' : stepNum > i + 1 ? '#001a48' : '#AEB5C0',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}>
                    {STEP_NAMES[key]}
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
          {step === 'tipo' && (
            <div key="step-tipo" className="booking-step-in">
              <StepTipoConsulta
                profile={profile}
                tipo={tipo}
                modalidad={modalidad}
                onTipo={setTipo}
                onModalidad={setModalidad}
                onNext={() => goNextFrom('tipo')}
                ocultarModalidad={multiSede}
              />
            </div>
          )}

          {step === 'sede' && (
            <div key="step-sede" className="booking-step-in">
              <StepSede
                slug={profile.booking_slug}
                tipo={tipo}
                nombreProfesional={profile.nombre}
                sedes={profile.sedes}
                onSede={handleSede}
                onBack={() => goBackFrom('sede')}
              />
            </div>
          )}

          {step === 'fecha' && (
            <div key="step-fecha" className="booking-step-in">
              <StepCalendario
                tipo={tipo}
                slug={profile.booking_slug}
                selectedFecha={selectedFecha}
                onFecha={(f) => { setSelectedFecha(f); setSelectedHora(null) }}
                onNext={() => goNextFrom('fecha')}
                onBack={handleBack}
                sede={sede}
                onCambiarSede={multiSede ? handleCambiarSede : undefined}
              />
            </div>
          )}

          {step === 'hora' && selectedFecha && (
            <div key="step-hora" className="booking-step-in">
              <StepHorario
                slug={profile.booking_slug}
                fecha={selectedFecha}
                tipo={tipo}
                selectedHora={selectedHora}
                onHora={setSelectedHora}
                onNext={() => goNextFrom('hora')}
                onBack={handleBack}
                sede={sede}
                onCambiarSede={multiSede ? handleCambiarSede : undefined}
              />
            </div>
          )}

          {step === 'datos' && selectedFecha && selectedHora && (
            <div key="step-datos" className="booking-step-in">
              <StepDatos
                profile={profile}
                tipo={tipo}
                fecha={selectedFecha}
                hora={selectedHora}
                modalidad={modalidad}
                form={datosForm}
                onForm={setDatosForm}
                onNext={() => goNextFrom('datos')}
                onBack={handleBack}
                sede={sede}
              />
            </div>
          )}

          {step === 'pago' && selectedFecha && selectedHora && (
            <div key="step-pago" className="booking-step-in">
              <StepPago
                profile={profile}
                tipo={tipo}
                fecha={selectedFecha}
                hora={selectedHora}
                modalidad={modalidad}
                datosForm={datosForm}
                onConfirmacion={(conf) => {
                  setConfirmacion(conf)
                  setStep('confirmacion')
                }}
                onBack={handleBack}
                onErrPago={() => setStep('err-pay')}
                onErrSlot={() => setStep('err-slot')}
                sede={sede}
              />
            </div>
          )}

          {step === 'confirmacion' && confirmacion && selectedFecha && selectedHora && (
            <div key="step-confirmacion" className="booking-step-in">
              <StepConfirmacion
                profile={profile}
                tipo={tipo}
                fecha={selectedFecha}
                hora={selectedHora}
                modalidad={modalidad}
                confirmacion={confirmacion}
                datosForm={datosForm}
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
                  onClick={() => goToKey('fecha')}
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
                  onClick={() => goToKey('datos')}
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
