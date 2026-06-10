'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { detectarGeneradorCustom } from '@/lib/planillas/generadores-custom'
import type { Paciente, ProfesionalObraSocial, TurnoRow } from '@/types/database'
import './planilla-os.css'

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

type SesionDeclarada = {
  id?: string
  fecha: string
  hora_entrada: string
  hora_salida: string
}

type SesionAgenda = {
  fecha_hora: string
  duracion_min: number | null
}

function toArgDate(iso: string): Date {
  return new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
}

function fmtTime(d: Date): string {
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
}

function formatDayLabel(fecha: string): string {
  const [year, month, day] = fecha.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return format(d, "EEE d MMM", { locale: es })
}

export default function PlanillaOSSlide({
  open,
  onClose,
  paciente,
  osConfig,
  mes,
  anio,
  turnos,
  firmaProfesionalUrl,
  profesionalNombre,
  matricula,
}: {
  open: boolean
  onClose: () => void
  paciente: Paciente
  osConfig: ProfesionalObraSocial | undefined
  mes: number
  anio: number
  turnos: TurnoRow[]
  firmaProfesionalUrl?: string
  profesionalNombre?: string
  matricula?: string
}) {
  const [declaradas, setDeclaradas] = useState<SesionDeclarada[]>([])
  const [loadingDecl, setLoadingDecl] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formFecha, setFormFecha] = useState('')
  const [formEntrada, setFormEntrada] = useState('')
  const [formSalida, setFormSalida] = useState('')
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mesNum = mes + 1 // API expects 1-indexed

  const loadDeclaradas = useCallback(async () => {
    if (!open || !paciente.id) return
    setLoadingDecl(true)
    try {
      const res = await fetch(
        `/api/sesiones-declaradas?paciente_id=${paciente.id}&mes=${mesNum}&anio=${anio}`
      )
      if (res.ok) {
        const data = await res.json() as { sesiones: SesionDeclarada[] }
        setDeclaradas(data.sesiones ?? [])
      }
    } finally {
      setLoadingDecl(false)
    }
  }, [open, paciente.id, mesNum, anio])

  useEffect(() => {
    if (open) {
      loadDeclaradas()
      setShowForm(false)
      setError(null)
    }
  }, [open, loadDeclaradas])

  // Sesiones from agenda for this month — only realizado
  const sesionesAgenda: SesionAgenda[] = turnos.filter((t) => {
    const d = toArgDate(t.fecha_hora)
    return (
      d.getUTCMonth() === mes &&
      d.getUTCFullYear() === anio &&
      t.estado === 'realizado'
    )
  })

  function addDeclarada() {
    if (!formFecha || !formEntrada || !formSalida) return
    setDeclaradas((prev) => [
      ...prev,
      { fecha: formFecha, hora_entrada: formEntrada, hora_salida: formSalida },
    ])
    setFormFecha('')
    setFormEntrada('')
    setFormSalida('')
    setShowForm(false)
  }

  function removeDeclarada(idx: number) {
    setDeclaradas((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleGenerar() {
    if (!osConfig) return
    setError(null)
    setGenerando(true)
    try {
      // Save declared sessions first
      const saveRes = await fetch('/api/sesiones-declaradas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: paciente.id,
          mes: mesNum,
          anio,
          sesiones: declaradas,
        }),
      })
      if (!saveRes.ok) {
        const d = await saveRes.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? 'Error al guardar sesiones declaradas')
      }

      // Determine endpoint
      const hasTemplate = !!osConfig.planilla_template_id
      const generadorCustom = detectarGeneradorCustom(osConfig.nombre)
      const endpoint = hasTemplate
        ? '/api/planillas/generar'
        : generadorCustom?.endpoint ?? null

      if (!endpoint) {
        throw new Error('Esta obra social no tiene plantilla configurada. Contactá al soporte de KLIA.')
      }

      const body: Record<string, unknown> = {
        paciente_id: paciente.id,
        mes: mesNum,
        anio,
        os_config_id: osConfig.id,
        sesiones_declaradas: declaradas,
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? 'Error al generar la planilla')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Planilla_${paciente.apellido}_${MESES_NOMBRES[mes]}_${anio}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la planilla.')
    } finally {
      setGenerando(false)
    }
  }

  const iniciales = `${paciente.nombre[0] ?? ''}${paciente.apellido[0] ?? ''}`.toUpperCase()
  const totalPlanilla = sesionesAgenda.length + declaradas.length

  return (
    <>
      <div className={`plos-scrim${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`plos-panel${open ? ' open' : ''}`} aria-hidden={!open}>
        {/* Header */}
        <div className="plos-hdr">
          <div className="plos-av">{iniciales}</div>
          <div className="plos-h-info">
            <div className="plos-name">{paciente.apellido}, {paciente.nombre}</div>
            <div className="plos-meta">
              <span>{osConfig?.nombre ?? 'Obra Social'}</span>
              <span className="dot" />
              <span>{MESES_NOMBRES[mes]} {anio}</span>
            </div>
          </div>
          <button className="plos-close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6l-12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="plos-body">

          {/* Section 1: Sesiones registradas */}
          <div className="pl-sec">
            <div className="pl-sec-hdr">
              <h4>Sesiones registradas</h4>
              <span className="badge-count">{sesionesAgenda.length}</span>
            </div>
            {sesionesAgenda.length === 0 ? (
              <div className="pl-empty">
                Sin sesiones realizadas en {MESES_NOMBRES[mes]} {anio}.
              </div>
            ) : (
              <div className="pl-list">
                {sesionesAgenda.map((t, i) => {
                  const argDate = toArgDate(t.fecha_hora)
                  const entrada = fmtTime(argDate)
                  const finDate = new Date(argDate.getTime() + (t.duracion_min ?? 50) * 60 * 1000)
                  const salida = fmtTime(finDate)
                  const label = format(
                    new Date(argDate.getUTCFullYear(), argDate.getUTCMonth(), argDate.getUTCDate()),
                    "EEE d MMM", { locale: es }
                  )
                  return (
                    <div key={i} className="pl-row readonly">
                      <div className="check-icn">
                        <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                      <span className="date-txt">{label}</span>
                      <span className="time-txt">{entrada} – {salida} hs</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 2: Sesiones a declarar */}
          <div className="pl-sec">
            <div className="pl-sec-hdr">
              <h4>Sesiones a declarar</h4>
              <span className="badge-count">{loadingDecl ? '…' : declaradas.length}</span>
              <div className="info-tip">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
                <div className="tooltip">
                  Sesiones adicionales que se incluirán en la planilla para la obra social. No afectan la agenda ni los cobros.
                </div>
              </div>
            </div>

            {declaradas.length === 0 && !showForm ? (
              <div className="pl-empty">
                Sin sesiones a declarar todavía.
                <br />
                <button className="add-link" onClick={() => setShowForm(true)}>
                  <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                  Agregar sesión a declarar
                </button>
              </div>
            ) : (
              <>
                {declaradas.length > 0 && (
                  <div className="pl-list">
                    {declaradas.map((d, i) => (
                      <div key={i} className="pl-row declared">
                        <div className="cal-icn">
                          <svg viewBox="0 0 24 24">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M8 2v4M16 2v4M3 10h18" />
                          </svg>
                        </div>
                        <span className="date-txt">{formatDayLabel(d.fecha)}</span>
                        <span className="time-txt">{d.hora_entrada} – {d.hora_salida} hs</span>
                        <button
                          className="del-btn"
                          title="Eliminar"
                          onClick={() => removeDeclarada(i)}
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!showForm && (
                  <button className="add-trigger" onClick={() => setShowForm(true)}>
                    <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                    Agregar sesión a declarar
                  </button>
                )}
              </>
            )}

            {showForm && (
              <div className="add-form">
                <div className="form-grid">
                  <div className="field">
                    <label>Fecha</label>
                    <input
                      type="date"
                      value={formFecha}
                      onChange={(e) => setFormFecha(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Hora entrada</label>
                    <input
                      type="time"
                      value={formEntrada}
                      onChange={(e) => setFormEntrada(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Hora salida</label>
                    <input
                      type="time"
                      value={formSalida}
                      onChange={(e) => setFormSalida(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="plos-btn" onClick={() => { setShowForm(false); setFormFecha(''); setFormEntrada(''); setFormSalida('') }}>
                    Cancelar
                  </button>
                  <button
                    className="plos-btn plos-btn-blue"
                    onClick={addDeclarada}
                    disabled={!formFecha || !formEntrada || !formSalida}
                  >
                    <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                    Agregar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Resumen y firmas */}
          <div className="pl-sec">
            <div className="pl-sec-hdr">
              <h4>Resumen y firmas</h4>
            </div>
            <div className="pl-summary">
              <div className="pl-summary-row">
                <span>Sesiones registradas</span>
                <span>{sesionesAgenda.length}</span>
              </div>
              <div className="pl-summary-row">
                <span>Sesiones a declarar</span>
                <span>{declaradas.length}</span>
              </div>
              <div className="pl-summary-row total">
                <span>Total en planilla</span>
                <span>{totalPlanilla}</span>
              </div>
              {declaradas.length > 0 && sesionesAgenda.length > 0 && (
                <div className="pl-summary-row" style={{ paddingTop: 4 }}>
                  <span className="sub">
                    ({sesionesAgenda.length} registradas + {declaradas.length} a declarar)
                  </span>
                </div>
              )}
            </div>

            {firmaProfesionalUrl ? (
              <div className="firma-preview">
                <div className="firma-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={firmaProfesionalUrl} alt="Firma profesional" />
                </div>
                <div className="firma-info">
                  <div className="name">Firma del profesional</div>
                  {profesionalNombre && (
                    <div className="mp">
                      {profesionalNombre}{matricula ? ` · MP ${matricula}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="firma-missing">
                <svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                Sin firma cargada.{' '}
                <a href="/ajustes">Cargar firma en Ajustes</a>
              </div>
            )}
          </div>

          {error && <div className="plos-error">{error}</div>}
        </div>

        {/* Footer */}
        <div className="plos-foot">
          <button className="plos-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="plos-btn plos-btn-blue"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleGenerar}
            disabled={generando || totalPlanilla === 0}
          >
            {generando ? (
              <>Generando…</>
            ) : (
              <>
                <svg viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Generar planilla PDF
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
