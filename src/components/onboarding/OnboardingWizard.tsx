'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import './onboarding.css'

const TOTAL_STEPS = 5

const DAY_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán',
  'Entre Ríos', 'Salta', 'Misiones', 'Chaco', 'Corrientes', 'Santiago del Estero',
  'San Juan', 'Jujuy', 'Río Negro', 'Neuquén', 'Formosa', 'Chubut',
  'San Luis', 'Catamarca', 'La Rioja', 'La Pampa', 'Santa Cruz', 'Tierra del Fuego',
]

const MONEDA_OPTIONS = [
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'EUR', label: 'EUR — Euro' },
]

type ScheduleDay = { on: boolean; from: string; to: string }

function timeToHour(t: string): number {
  return parseInt(t.split(':')[0], 10)
}

export default function OnboardingWizard({
  nombreProfesional,
  initialMatricula,
  initialTelefono,
  initialProvincia,
}: {
  nombreProfesional: string
  initialMatricula?: string | null
  initialTelefono?: string | null
  initialProvincia?: string | null
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set())
  const [visible, setVisible] = useState(true)
  const [closing, setClosing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Step 2
  const [matricula, setMatricula] = useState(initialMatricula ?? '')
  const [matriculaTipo, setMatriculaTipo] = useState<'provincial' | 'nacional' | ''>('')
  const [matriculaProvincia, setMatriculaProvincia] = useState('')
  const [telefono, setTelefono] = useState(initialTelefono ?? '')
  const [provincia, setProvincia] = useState(initialProvincia ?? '')
  const [dni, setDni] = useState('')
  const [dniError, setDniError] = useState<string | null>(null)

  // Hydrate fields from auth user_metadata if profile fields are empty
  useEffect(() => {
    async function hydrateFromMetadata() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const meta = user.user_metadata as Record<string, string | undefined>
      if (!matricula && meta.matricula) setMatricula(meta.matricula)
      if (!telefono && meta.telefono) setTelefono(meta.telefono)
      if (!provincia && meta.provincia) setProvincia(meta.provincia)
    }
    hydrateFromMetadata()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Step 3
  const [schedule, setSchedule] = useState<ScheduleDay[]>([
    { on: true,  from: '09:00', to: '18:00' },
    { on: true,  from: '09:00', to: '18:00' },
    { on: true,  from: '09:00', to: '18:00' },
    { on: true,  from: '09:00', to: '18:00' },
    { on: true,  from: '09:00', to: '18:00' },
    { on: false, from: '09:00', to: '13:00' },
    { on: false, from: '09:00', to: '13:00' },
  ])

  // Step 4
  const [moneda, setMoneda] = useState('ARS')
  const [honorario, setHonorario] = useState('')

  const closeOverlay = useCallback(() => {
    setClosing(true)
    setTimeout(() => setVisible(false), 260)
  }, [])

  function persistComplete(data?: Record<string, unknown>) {
    fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', data }),
    }).catch(() => {})
  }

  function persistStep(data: Record<string, unknown>) {
    fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'step', data }),
    }).catch(() => {})
  }

  function goTo(newStep: number, isSkip = false) {
    if (newStep < 1 || newStep > TOTAL_STEPS || newStep === step) return
    if (isSkip) setSkippedSteps(prev => new Set(prev).add(step))
    setStep(newStep)
    if (newStep === TOTAL_STEPS) {
      setTimeout(() => fireConfetti(), 200)
    }
  }

  function next(isSkip = false) {
    if (step === 2) {
      const dniClean = dni.replace(/\D/g, '')
      if (!dniClean || dniClean.length < 7 || dniClean.length > 8) {
        setDniError('Ingresá un DNI válido (7 u 8 dígitos).')
        return
      }
      setDniError(null)
      persistStep({
        dni: dniClean,
        matricula: matricula || null,
        matricula_tipo: matriculaTipo || null,
        matricula_provincia: matriculaTipo === 'provincial' ? (matriculaProvincia || null) : null,
        telefono: telefono || null,
        provincia: provincia || null,
      })
    }
    if (step === 3 && !isSkip) {
      const horarios = Object.fromEntries(
        schedule.map((s, i) => [DAY_KEYS[i], {
          activo: s.on,
          inicio: timeToHour(s.from),
          fin: timeToHour(s.to),
        }])
      )
      persistStep({ horarios_por_dia: horarios })
    }
    if (step === 4) {
      const monto = parseFloat(honorario.replace(/\./g, '').replace(',', '.')) || null
      if (!isSkip) {
        persistComplete({ booking_precio_sesion: monto, booking_moneda: moneda })
      } else {
        persistComplete()
      }
    }
    if (step < TOTAL_STEPS) goTo(step + 1, isSkip)
  }

  function prev() {
    if (step > 1) goTo(step - 1)
  }

  // Progress dots
  function renderProgress() {
    if (step === TOTAL_STEPS) return null
    const dots: React.ReactNode[] = []
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      let dotCls = ''
      if (i === step) dotCls = 'active'
      else if (i < step) dotCls = skippedSteps.has(i) ? 'skipped' : 'done'
      dots.push(<div key={`dot-${i}`} className={`prog-dot ${dotCls}`} />)
      if (i < TOTAL_STEPS) {
        let lineCls = ''
        if (i < step) lineCls = 'done'
        else if (i === step) lineCls = 'active'
        dots.push(<div key={`line-${i}`} className={`prog-line ${lineCls}`} />)
      }
    }
    return (
      <div className="ob-progress">
        <div className="prog-dots">{dots}</div>
        <span className="prog-label">Paso {Math.min(step, 4)} de 4</span>
      </div>
    )
  }

  // Confetti
  function fireConfetti() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const colors = ['#1F4FD9', '#0E8A5F', '#F59E0B', '#DC2626', '#5B3DC9', '#009EE3', '#10B981']
    const pieces = Array.from({ length: 120 }, () => ({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 300,
      y: canvas.height * 0.42,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 18 - 4,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.3,
      gravity: 0.35 + Math.random() * 0.15,
      opacity: 1,
      decay: 0.003 + Math.random() * 0.004,
    }))
    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      let alive = false
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy
        p.vy += p.gravity; p.vx *= 0.98
        p.rot += p.rv; p.opacity -= p.decay
        if (p.opacity <= 0) continue
        alive = true
        ctx!.save()
        ctx!.globalAlpha = Math.max(0, p.opacity)
        ctx!.translate(p.x, p.y)
        ctx!.rotate(p.rot)
        ctx!.fillStyle = p.color
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx!.restore()
      }
      if (alive) requestAnimationFrame(draw)
      else ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
    }
    requestAnimationFrame(draw)
  }

  // Checklist for step 5
  function renderChecklist() {
    const items = [
      { step: 2, label: 'Datos profesionales' },
      { step: 3, label: 'Horarios configurados' },
      { step: 4, label: 'Honorarios definidos' },
    ]
    return (
      <div className="ob-checklist">
        {items.map(item => {
          const sk = skippedSteps.has(item.step)
          return (
            <div key={item.step} className="ob-check-item">
              <span className={`ck-icon ${sk ? 'skipped' : 'done'}`}>
                {sk ? (
                  <svg viewBox="0 0 16 16"><path d="M4 8h8" strokeLinecap="round" /></svg>
                ) : (
                  <svg viewBox="0 0 16 16"><path d="M4 8l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </span>
              <span style={sk ? { color: 'var(--muted-2)', textDecoration: 'line-through' } : {}}>
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  if (!visible) return null

  return (
    <>
      <canvas ref={canvasRef} className="ob-confetti-canvas" />

      <div className={`ob-overlay${closing ? ' ob-closing' : ''}`}>
        <div className="ob-backdrop" />
        <div className="ob-container">

          <div className="ob-card">
            {renderProgress()}

            {/* Step 1 — Bienvenida */}
            <div className={`ob-step${step === 1 ? ' active' : ''}`}>
              <div className="ob-step-inner ob-center">
                <div className="ob-hero-icon">
                  <svg viewBox="0 0 80 80" fill="none">
                    <rect x="8" y="16" width="44" height="52" rx="6" stroke="var(--accent)" strokeWidth="2.5" fill="var(--accent-soft)" />
                    <circle cx="30" cy="34" r="6" stroke="var(--accent)" strokeWidth="2" fill="white" />
                    <path d="M18 52h24M18 58h16" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                    <rect x="48" y="8" width="28" height="32" rx="5" stroke="var(--ok)" strokeWidth="2.5" fill="#E7F5EE" />
                    <path d="M56 20h12M56 26h8" stroke="var(--ok)" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="62" cy="14" r="2" fill="var(--ok)" />
                    <path d="M62 42c0 0-4-3-4-6a4 4 0 1 1 8 0c0 3-4 6-4 6z" fill="#F87171" stroke="#DC2626" strokeWidth="1.5" />
                  </svg>
                </div>
                <h1 className="ob-title">¡Bienvenido/a a KLIA, {nombreProfesional}!</h1>
                <p className="ob-subtitle">En 4 pasos rápidos vas a tener tu consultorio listo para atender pacientes.</p>
                <div className="ob-time">
                  <svg viewBox="0 0 20 20" fill="none" stroke="var(--muted)" strokeWidth="1.6">
                    <circle cx="10" cy="10" r="7.5" />
                    <path d="M10 6v4.5l3 1.5" />
                  </svg>
                  Menos de 3 minutos
                </div>
                <div className="ob-actions">
                  <button className="ob-btn-primary" onClick={() => next()}>Empezar</button>
                </div>
              </div>
            </div>

            {/* Step 2 — Datos profesionales */}
            <div className={`ob-step${step === 2 ? ' active' : ''}`}>
              <div className="ob-step-inner">
                <h2 className="ob-step-title">Tu información profesional</h2>
                <p className="ob-step-desc">Los pacientes y las planillas usan estos datos.</p>
                <div className="ob-form">
                  <div className="ob-field">
                    <label>DNI <em>*</em></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Ej: 27704316"
                      value={dni}
                      maxLength={9}
                      onChange={e => {
                        setDni(e.target.value.replace(/\D/g, ''))
                        setDniError(null)
                      }}
                    />
                    {dniError && <span className="ob-field-error">{dniError}</span>}
                  </div>
                  <div className="ob-field">
                    <label>Tipo de matrícula</label>
                    <select
                      value={matriculaTipo}
                      onChange={e => setMatriculaTipo(e.target.value as 'provincial' | 'nacional' | '')}
                    >
                      <option value="">Seleccioná el tipo</option>
                      <option value="provincial">Provincial</option>
                      <option value="nacional">Nacional</option>
                    </select>
                  </div>
                  {matriculaTipo === 'provincial' && (
                    <div className="ob-field">
                      <label>Provincia de la matrícula</label>
                      <select
                        value={matriculaProvincia}
                        onChange={e => setMatriculaProvincia(e.target.value)}
                      >
                        <option value="">Seleccioná la provincia</option>
                        {PROVINCIAS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="ob-field">
                    <label>Número de matrícula <em>*</em></label>
                    <input
                      type="text"
                      placeholder="Ej: 12345"
                      value={matricula}
                      onChange={e => setMatricula(e.target.value)}
                    />
                  </div>
                  <div className="ob-field">
                    <label>Teléfono</label>
                    <div className="ob-input-group">
                      <span className="ob-pfx">+54</span>
                      <input
                        type="tel"
                        placeholder="9 11 1234-5678"
                        value={telefono}
                        onChange={e => setTelefono(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="ob-field">
                    <label>Provincia</label>
                    <select value={provincia} onChange={e => setProvincia(e.target.value)}>
                      <option value="">Seleccionar</option>
                      {PROVINCIAS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="ob-actions-row">
                  <button className="ob-btn-back" onClick={prev}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M13 4l-6 6 6 6" />
                    </svg>
                    Atrás
                  </button>
                  <div className="ob-actions-right">
                    <button className="ob-btn-primary" onClick={() => next()}>Continuar</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 — Horarios */}
            <div className={`ob-step${step === 3 ? ' active' : ''}`}>
              <div className="ob-step-inner">
                <h2 className="ob-step-title">¿Cuándo atendés?</h2>
                <p className="ob-step-desc">Configurá tus días y horarios. Podés cambiarlo cuando quieras desde Ajustes.</p>
                <div className="ob-schedule">
                  {schedule.map((s, i) => (
                    <div key={i} className="ob-sch-row" data-active={String(s.on)}>
                      <button
                        className="day-toggle"
                        data-on={String(s.on)}
                        onClick={() => setSchedule(prev => prev.map((d, j) => j === i ? { ...d, on: !d.on } : d))}
                      />
                      <span className="day-label">{DAY_LABELS[i]}</span>
                      <div className="day-times">
                        {s.on ? (
                          <>
                            <input
                              type="time"
                              value={s.from}
                              onChange={e => setSchedule(prev => prev.map((d, j) => j === i ? { ...d, from: e.target.value } : d))}
                            />
                            <span className="arrow">→</span>
                            <input
                              type="time"
                              value={s.to}
                              onChange={e => setSchedule(prev => prev.map((d, j) => j === i ? { ...d, to: e.target.value } : d))}
                            />
                          </>
                        ) : (
                          <span className="off">desactivado</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ob-actions-row">
                  <button className="ob-btn-back" onClick={prev}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M13 4l-6 6 6 6" />
                    </svg>
                    Atrás
                  </button>
                  <div className="ob-actions-right">
                    <button className="ob-skip-step" onClick={() => next(true)}>Saltar este paso</button>
                    <button className="ob-btn-primary" onClick={() => next()}>Continuar</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 — Honorarios */}
            <div className={`ob-step${step === 4 ? ' active' : ''}`}>
              <div className="ob-step-inner">
                <h2 className="ob-step-title">¿Cuánto cobrás por sesión?</h2>
                <p className="ob-step-desc">Se va a pre-cargar en cada turno nuevo que agendés.</p>
                <div className="ob-form">
                  <div className="ob-field">
                    <label>Moneda</label>
                    <select value={moneda} onChange={e => setMoneda(e.target.value)}>
                      {MONEDA_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ob-field">
                    <label>Honorario por sesión</label>
                    <div className="ob-input-group">
                      <span className="ob-pfx">$</span>
                      <input
                        type="text"
                        placeholder="65.000"
                        value={honorario}
                        onChange={e => {
                          const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                          if (raw === '') { setHonorario(''); return }
                          const num = parseInt(raw, 10)
                          if (isNaN(num)) { setHonorario(''); return }
                          setHonorario(num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
                        }}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </div>
                <div className="ob-tip">
                  <svg viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                    <circle cx="10" cy="10" r="7.5" />
                    <path d="M10 7v3M10 13h.01" />
                  </svg>
                  <span>Podés tener precios distintos por paciente desde su ficha.</span>
                </div>
                <div className="ob-actions-row">
                  <button className="ob-btn-back" onClick={prev}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M13 4l-6 6 6 6" />
                    </svg>
                    Atrás
                  </button>
                  <div className="ob-actions-right">
                    <button className="ob-skip-step" onClick={() => next(true)}>Saltar</button>
                    <button className="ob-btn-primary" onClick={() => next()}>Guardar y empezar</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5 — ¡Listo! */}
            <div className={`ob-step${step === 5 ? ' active' : ''}`}>
              <div className="ob-step-inner ob-center">
                <div className="ob-done-icon">
                  <svg viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="28" fill="var(--ok-soft)" stroke="var(--ok)" strokeWidth="2.5" />
                    <path d="M20 33l8 8 16-18" stroke="var(--ok)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h1 className="ob-title">¡Tu consultorio está listo!</h1>
                {renderChecklist()}
                <p className="ob-subtitle" style={{ marginTop: 20 }}>¿Qué querés hacer primero?</p>
                <div className="ob-quick-actions">
                  <button className="ob-quick-btn" onClick={() => { closeOverlay(); setTimeout(() => window.dispatchEvent(new CustomEvent('openNuevoTurno')), 300) }}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="3" y="4" width="14" height="14" rx="2" />
                      <path d="M7 2v4M13 2v4M3 9h14" />
                    </svg>
                    Agendar mi primer turno
                  </button>
                  <button className="ob-quick-btn" onClick={() => { closeOverlay(); router.push('/pacientes/nuevo') }}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="10" cy="7" r="3.5" />
                      <path d="M3 18a7 7 0 0 1 14 0" />
                    </svg>
                    Agregar un paciente
                  </button>
                  <button className="ob-quick-btn" onClick={() => { closeOverlay(); router.push('/ajustes/integraciones') }}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M7 3v14M3 10h14M14 6l3 4-3 4" />
                    </svg>
                    Ver mi link de reservas
                  </button>
                </div>
                <button className="ob-skip-link" onClick={closeOverlay} style={{ marginTop: 16 }}>
                  Ir al dashboard
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
