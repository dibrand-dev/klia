'use client'

import { useState } from 'react'
import SlideOver from '@/components/ui/SlideOver'
import { cn } from '@/lib/utils'
import { format, subMonths } from 'date-fns'

const inputCls = 'w-full bg-surface-container-high border border-outline-variant/15 text-on-surface rounded-lg px-4 py-3 text-sm focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none'
const labelCls = 'block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-2'

const TIPOS_SOLICITUD = [
  'Autorización de tratamiento psicológico',
  'Autorización de tratamiento médico',
  'Solicitud de medicamento especial',
  'Incorporación a programa crónico',
  'Renovación de autorización',
  'Otro',
]

const CIE10_FRECUENTES = [
  { codigo: 'F32', descripcion: 'Episodio depresivo' },
  { codigo: 'F33', descripcion: 'Trastorno depresivo recurrente' },
  { codigo: 'F41.0', descripcion: 'Trastorno de pánico' },
  { codigo: 'F41.1', descripcion: 'Trastorno de ansiedad generalizada' },
  { codigo: 'F41.2', descripcion: 'Trastorno mixto ansioso-depresivo' },
  { codigo: 'F40.1', descripcion: 'Fobia social' },
  { codigo: 'F40.0', descripcion: 'Agorafobia' },
  { codigo: 'F42', descripcion: 'Trastorno obsesivo-compulsivo' },
  { codigo: 'F43.1', descripcion: 'Trastorno de estrés postraumático' },
  { codigo: 'F43.2', descripcion: 'Trastorno de adaptación' },
  { codigo: 'F44', descripcion: 'Trastornos disociativos' },
  { codigo: 'F50.0', descripcion: 'Anorexia nerviosa' },
  { codigo: 'F50.2', descripcion: 'Bulimia nerviosa' },
  { codigo: 'F60.3', descripcion: 'Trastorno de personalidad emocionalmente inestable' },
  { codigo: 'F60.0', descripcion: 'Trastorno de personalidad paranoide' },
  { codigo: 'F20', descripcion: 'Esquizofrenia' },
  { codigo: 'F25', descripcion: 'Trastorno esquizoafectivo' },
  { codigo: 'F30', descripcion: 'Episodio maníaco' },
  { codigo: 'F31', descripcion: 'Trastorno afectivo bipolar' },
  { codigo: 'F10', descripcion: 'Trastornos mentales por uso de alcohol' },
  { codigo: 'F11', descripcion: 'Trastornos mentales por uso de opioides' },
  { codigo: 'F90.0', descripcion: 'Trastorno por déficit de atención con hiperactividad' },
  { codigo: 'F84.0', descripcion: 'Autismo infantil' },
  { codigo: 'F70', descripcion: 'Retraso mental leve' },
  { codigo: 'F45', descripcion: 'Trastornos somatomorfos' },
  { codigo: 'F51.0', descripcion: 'Insomnio no orgánico' },
  { codigo: 'F63.0', descripcion: 'Ludopatía' },
  { codigo: 'F98.8', descripcion: 'Trastornos del comportamiento especificados' },
  { codigo: 'Z63.0', descripcion: 'Problemas en la relación de pareja' },
  { codigo: 'Z71.4', descripcion: 'Consejería sobre uso de alcohol' },
  { codigo: 'I10', descripcion: 'Hipertensión esencial' },
  { codigo: 'E11', descripcion: 'Diabetes mellitus tipo 2' },
  { codigo: 'E78', descripcion: 'Trastornos del metabolismo de lipoproteínas' },
  { codigo: 'J45', descripcion: 'Asma' },
  { codigo: 'M54.5', descripcion: 'Lumbalgia' },
  { codigo: 'M54.2', descripcion: 'Cervicalgia' },
  { codigo: 'G43', descripcion: 'Migraña' },
  { codigo: 'K29', descripcion: 'Gastritis y duodenitis' },
  { codigo: 'K58', descripcion: 'Síndrome del intestino irritable' },
  { codigo: 'N39.0', descripcion: 'Infección de vías urinarias' },
  { codigo: 'J06', descripcion: 'Infección aguda de vías respiratorias superiores' },
  { codigo: 'J30', descripcion: 'Rinitis alérgica' },
  { codigo: 'L20', descripcion: 'Dermatitis atópica' },
  { codigo: 'M79.3', descripcion: 'Fibromialgia' },
  { codigo: 'G47.0', descripcion: 'Insomnio' },
  { codigo: 'R51', descripcion: 'Cefalea' },
  { codigo: 'R07.0', descripcion: 'Dolor de garganta' },
  { codigo: 'Z73.0', descripcion: 'Agotamiento vital (burn-out)' },
  { codigo: 'Z76.3', descripcion: 'Persona en buena salud en control rutinario' },
  { codigo: 'Z00.0', descripcion: 'Examen médico general' },
]

type Phase = 'form' | 'draft'

interface InformeExistente {
  id: string
  tipo_solicitud: string
  diagnostico_cie10_codigo: string | null
  diagnostico_cie10_descripcion: string | null
  periodo_desde: string
  periodo_hasta: string
  observaciones_profesional: string | null
  contenido_generado: string
  estado: string
}

export default function NuevoInformeSlide({
  open,
  onClose,
  pacienteId,
  pacienteNombre,
  initialDiagnosticoCodigo,
  initialDiagnosticoDesc,
  informeExistente,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  pacienteId: string
  pacienteNombre: string
  initialDiagnosticoCodigo?: string | null
  initialDiagnosticoDesc?: string | null
  informeExistente?: InformeExistente | null
  onSuccess?: () => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const sixMonthsAgo = format(subMonths(new Date(), 6), 'yyyy-MM-dd')

  const [phase, setPhase] = useState<Phase>(informeExistente ? 'draft' : 'form')
  const [tipoSolicitud, setTipoSolicitud] = useState(informeExistente?.tipo_solicitud ?? TIPOS_SOLICITUD[0])
  const [tipoOtro, setTipoOtro] = useState('')
  const [cie10Query, setCie10Query] = useState(
    informeExistente?.diagnostico_cie10_codigo
      ? `${informeExistente.diagnostico_cie10_codigo} — ${informeExistente.diagnostico_cie10_descripcion ?? ''}`
      : initialDiagnosticoCodigo
        ? `${initialDiagnosticoCodigo}${initialDiagnosticoDesc ? ` — ${initialDiagnosticoDesc}` : ''}`
        : ''
  )
  const [cie10Selected, setCie10Selected] = useState<{ codigo: string; descripcion: string } | null>(
    informeExistente?.diagnostico_cie10_codigo
      ? { codigo: informeExistente.diagnostico_cie10_codigo, descripcion: informeExistente.diagnostico_cie10_descripcion ?? '' }
      : initialDiagnosticoCodigo
        ? { codigo: initialDiagnosticoCodigo, descripcion: initialDiagnosticoDesc ?? '' }
        : null
  )
  const [showCie10List, setShowCie10List] = useState(false)
  const [periodoDes, setPeriodoDes] = useState(informeExistente?.periodo_desde ?? sixMonthsAgo)
  const [periodoHas, setPeriodoHas] = useState(informeExistente?.periodo_hasta ?? today)
  const [observaciones, setObservaciones] = useState(informeExistente?.observaciones_profesional ?? '')

  const [informeId, setInformeId] = useState(informeExistente?.id ?? '')
  const [contenido, setContenido] = useState(informeExistente?.contenido_generado ?? '')
  const [generating, setGenerating] = useState(false)
  const [signing, setSigning] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successUrl, setSuccessUrl] = useState('')

  const cie10Filtered = cie10Query.length >= 1
    ? CIE10_FRECUENTES.filter(d =>
        d.codigo.toLowerCase().includes(cie10Query.toLowerCase()) ||
        d.descripcion.toLowerCase().includes(cie10Query.toLowerCase())
      ).slice(0, 8)
    : []

  async function handleGenerar() {
    setErrorMsg('')
    setGenerating(true)
    const tipoFinal = tipoSolicitud === 'Otro' ? tipoOtro : tipoSolicitud
    try {
      const res = await fetch('/api/informes/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: pacienteId,
          tipo_solicitud: tipoFinal,
          diagnostico_cie10_codigo: cie10Selected?.codigo ?? null,
          diagnostico_cie10_descripcion: cie10Selected?.descripcion ?? null,
          periodo_desde: periodoDes,
          periodo_hasta: periodoHas,
          observaciones_profesional: observaciones || null,
        }),
      })
      const data = await res.json() as { informe_id?: string; contenido_generado?: string; error?: string }
      if (!res.ok) { setErrorMsg(data.error ?? 'Error al generar el informe'); return }
      setInformeId(data.informe_id!)
      setContenido(data.contenido_generado!)
      setPhase('draft')
    } catch {
      setErrorMsg('Error de conexión')
    } finally {
      setGenerating(false)
    }
  }

  async function handleFirmar() {
    setErrorMsg('')
    setSigning(true)
    try {
      const res = await fetch('/api/informes/firmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ informe_id: informeId, contenido_final: contenido }),
      })
      if (res.headers.get('content-type')?.includes('application/pdf')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Informe_${pacienteNombre.replace(/\s+/g, '_')}.pdf`
        document.body.appendChild(a); a.click()
        document.body.removeChild(a); URL.revokeObjectURL(url)
        onSuccess?.()
        onClose()
      } else {
        const data = await res.json() as { pdf_url?: string; error?: string }
        if (!res.ok) { setErrorMsg(data.error ?? 'Error al firmar'); return }
        setSuccessUrl(data.pdf_url ?? '')
        onSuccess?.()
      }
    } catch {
      setErrorMsg('Error de conexión')
    } finally {
      setSigning(false)
    }
  }

  function handleClose() {
    setPhase(informeExistente ? 'draft' : 'form')
    setErrorMsg('')
    setSuccessUrl('')
    setGenerating(false)
    setSigning(false)
    onClose()
  }

  const tipoFinal = tipoSolicitud === 'Otro' ? tipoOtro : tipoSolicitud

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title={phase === 'form' ? 'Nuevo Informe Médico' : 'Borrador del Informe'}
      subtitle={pacienteNombre}
      width="lg"
    >
      <div className="px-6 py-5 space-y-5">

        {phase === 'form' && (
          <>
            {/* Tipo de solicitud */}
            <div>
              <label className={labelCls}>Tipo de solicitud <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select
                value={tipoSolicitud}
                onChange={e => setTipoSolicitud(e.target.value)}
                className={inputCls}
              >
                {TIPOS_SOLICITUD.map(t => <option key={t}>{t}</option>)}
              </select>
              {tipoSolicitud === 'Otro' && (
                <input
                  type="text"
                  placeholder="Especificá el motivo..."
                  value={tipoOtro}
                  onChange={e => setTipoOtro(e.target.value)}
                  className={cn(inputCls, 'mt-2')}
                />
              )}
            </div>

            {/* CIE-10 */}
            <div className="relative">
              <label className={labelCls}>Diagnóstico CIE-10</label>
              <input
                type="text"
                placeholder="Buscar por código o descripción... (ej: F32, depresión)"
                value={cie10Query}
                onChange={e => { setCie10Query(e.target.value); setCie10Selected(null); setShowCie10List(true) }}
                onFocus={() => setShowCie10List(true)}
                onBlur={() => setTimeout(() => setShowCie10List(false), 150)}
                className={inputCls}
              />
              {showCie10List && cie10Filtered.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-outline-variant/20 rounded-xl shadow-xl overflow-hidden">
                  {cie10Filtered.map(d => (
                    <button
                      key={d.codigo}
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-container flex gap-3 items-center"
                      onMouseDown={() => {
                        setCie10Selected(d)
                        setCie10Query(`${d.codigo} — ${d.descripcion}`)
                        setShowCie10List(false)
                      }}
                    >
                      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-1.5 py-0.5 rounded">{d.codigo}</span>
                      <span style={{ color: 'var(--ink-2)' }}>{d.descripcion}</span>
                    </button>
                  ))}
                </div>
              )}
              {cie10Selected && (
                <p className="text-xs mt-1" style={{ color: 'var(--ok)' }}>
                  ✓ {cie10Selected.codigo} — {cie10Selected.descripcion}
                </p>
              )}
            </div>

            {/* Período */}
            <div>
              <label className={labelCls}>Período a considerar <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div className="flex gap-3 items-center">
                <input type="date" value={periodoDes} onChange={e => setPeriodoDes(e.target.value)} className={cn(inputCls, 'flex-1')} />
                <span className="text-sm" style={{ color: 'var(--muted)' }}>→</span>
                <input type="date" value={periodoHas} onChange={e => setPeriodoHas(e.target.value)} className={cn(inputCls, 'flex-1')} />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className={labelCls}>Observaciones adicionales</label>
              <textarea
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                rows={3}
                placeholder="Indicá aquí cualquier dato relevante que la IA deba considerar..."
                className={cn(inputCls, 'resize-none')}
              />
            </div>

            {errorMsg && (
              <div className="px-4 py-3 rounded-lg text-sm font-medium" style={{ background: 'var(--danger-soft, #fef2f2)', color: 'var(--danger, #dc2626)' }}>
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerar}
              disabled={generating || !tipoFinal.trim() || !periodoDes || !periodoHas}
              className={cn(
                'w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2',
                'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-container transition-colors',
                (generating || !tipoFinal.trim()) && 'opacity-60 cursor-not-allowed'
              )}
            >
              {generating ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: '1s' }}>progress_activity</span>
                  Generando con IA...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  Generar con IA
                </>
              )}
            </button>
          </>
        )}

        {phase === 'draft' && (
          <>
            {/* BORRADOR badge */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border" style={{ background: '#fffbeb', borderColor: '#f59e0b' }}>
              <span className="material-symbols-outlined text-base mt-0.5" style={{ color: '#d97706' }}>warning</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#d97706' }}>Borrador — Generado por IA</p>
                <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>Revisá el contenido antes de firmar. Podés editar el texto directamente.</p>
              </div>
            </div>

            {/* Editable content */}
            <div>
              <label className={labelCls}>Contenido del informe</label>
              <textarea
                value={contenido}
                onChange={e => setContenido(e.target.value)}
                rows={20}
                className={cn(inputCls, 'resize-y font-mono text-[12px] leading-relaxed')}
              />
            </div>

            {errorMsg && (
              <div className="px-4 py-3 rounded-lg text-sm font-medium" style={{ background: 'var(--danger-soft, #fef2f2)', color: 'var(--danger, #dc2626)' }}>
                {errorMsg}
              </div>
            )}

            {successUrl && (
              <div className="px-4 py-3 rounded-xl flex items-center gap-3 border" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                <span className="material-symbols-outlined text-base" style={{ color: '#16a34a' }}>check_circle</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#15803d' }}>Informe firmado y guardado en Drive</p>
                  <a href={successUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: '#16a34a' }}>
                    Ver en Google Drive
                  </a>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setPhase('form'); setContenido(''); setInformeId('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-outline-variant/20 hover:bg-surface-container transition-colors"
                style={{ color: 'var(--ink-2)' }}
              >
                ← Modificar formulario
              </button>
              <button
                type="button"
                onClick={handleGenerar}
                disabled={generating}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-outline-variant/20 hover:bg-surface-container transition-colors flex items-center gap-2"
                style={{ color: 'var(--ink-2)' }}
              >
                {generating ? (
                  <span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: '1s' }}>progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">refresh</span>
                )}
                Regenerar
              </button>
            </div>

            {!successUrl && (
              <button
                type="button"
                onClick={handleFirmar}
                disabled={signing || !contenido.trim()}
                className={cn(
                  'w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2',
                  'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-container transition-colors',
                  (signing || !contenido.trim()) && 'opacity-60 cursor-not-allowed'
                )}
              >
                {signing ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: '1s' }}>progress_activity</span>
                    Firmando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">draw</span>
                    Firmar y guardar PDF
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </SlideOver>
  )
}
