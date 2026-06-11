'use client'

import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TratamientoRow { periodo: string; tipo: string; motivo_fin: string }
interface MedicacionRow { indicada_por: string; medicamento: string; dosis: string }

interface AdmisionData {
  id?: string
  motivo_consulta?: string
  derivado_por?: string
  sintomatologia?: string
  antecedentes?: string
  tratamientos_anteriores?: TratamientoRow[]
  medicacion_actual?: MedicacionRow[]
  diagnostico?: string
  codigo_cie?: string
  programa_marco_teorico?: string
  sesiones_estimadas?: number | null
  frecuencia?: string
  abordaje?: string[]
  otras_prestaciones?: string[]
  duracion_estimada?: string
  pronostico?: string
  consentimiento_informado?: boolean
  firma_paciente_url?: string
  created_at?: string
  updated_at?: string
}

// ── CSS ────────────────────────────────────────────────────────────────────────

const css = `
.adm-wrap { padding: 8px 0 32px; }
.adm-empty { padding: 56px 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.adm-empty-icon { width: 68px; height: 68px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--border); display: grid; place-items: center; margin-bottom: 4px; }
.adm-empty-icon svg { width: 30px; height: 30px; stroke: var(--muted-2); stroke-width: 1.5; fill: none; }
.adm-empty h3 { font-size: 16px; font-weight: 600; color: var(--ink); margin: 0; }
.adm-empty p { font-size: 13.5px; color: var(--muted); margin: 0; max-width: 360px; line-height: 1.65; }
.adm-fepra { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; background: var(--surface-2); border: 1px solid var(--border); font-size: 11px; color: var(--muted-2); font-weight: 500; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.04em; }
.adm-fepra svg { width: 11px; height: 11px; stroke: var(--muted-2); stroke-width: 2; fill: none; }

.adm-form { display: flex; flex-direction: column; gap: 14px; }
.adm-sec { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; }
.adm-sec-hd { padding: 13px 20px; border-bottom: 1px solid var(--border); background: var(--surface-2); display: flex; align-items: center; gap: 10px; }
.sec-num { width: 20px; height: 20px; border-radius: 50%; background: var(--ink); color: white; font-size: 10px; font-weight: 700; display: grid; place-items: center; flex: none; }
.sec-title { font-size: 13px; font-weight: 600; color: var(--ink); }
.sec-sub { font-size: 12px; color: var(--muted-2); margin-left: auto; }
.adm-sec-bd { padding: 20px; display: flex; flex-direction: column; gap: 16px; }

.f-field { display: flex; flex-direction: column; gap: 6px; }
.f-label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.065em; color: var(--muted-2); display: flex; align-items: center; gap: 6px; }
.f-opt { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--muted-3); font-size: 10.5px; }
.adm-inp, .adm-sel, .adm-ta { border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font: inherit; font-size: 14px; color: var(--ink); background: var(--surface); outline: none; width: 100%; transition: border-color .12s ease, box-shadow .12s ease; }
.adm-inp:focus, .adm-sel:focus, .adm-ta:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.adm-inp::placeholder, .adm-ta::placeholder { color: var(--muted-3); }
.adm-ta { resize: vertical; min-height: 90px; line-height: 1.6; }
.adm-ta.tall { min-height: 120px; }
.f-g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.f-inline { display: flex; align-items: flex-end; gap: 12px; }
.f-inline .f-field { flex: 1; }

.rep-list { display: flex; flex-direction: column; gap: 8px; }
.rep-row { display: grid; gap: 8px; align-items: center; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); }
.rep-row.trat { grid-template-columns: 110px 1fr 1fr 28px; }
.rep-row.med { grid-template-columns: 1fr 1fr 120px 28px; }
.rep-row .adm-inp { background: var(--surface); }
.rep-del { width: 28px; height: 28px; border-radius: 6px; background: transparent; border: 1px solid transparent; display: grid; place-items: center; cursor: pointer; color: var(--muted-3); transition: background .1s, color .1s; flex: none; }
.rep-del:hover { background: var(--danger-soft); color: var(--danger); }
.rep-del svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; fill: none; }
.rep-add { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--accent); background: none; border: 1.5px dashed color-mix(in oklab, var(--accent) 45%, transparent); border-radius: 7px; padding: 7px 12px; cursor: pointer; transition: background .1s ease; align-self: flex-start; }
.rep-add:hover { background: var(--accent-soft); }
.rep-add svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2.5; fill: none; }

.chips-grp { display: flex; flex-wrap: wrap; gap: 8px; }
.chip-tog { padding: 6px 16px; border-radius: 100px; border: 1.5px solid var(--border); background: var(--surface); color: var(--ink-2); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .12s ease; }
.chip-tog:hover { border-color: var(--border-strong); background: var(--surface-2); }
.chip-tog.on { background: var(--ink); color: white; border-color: var(--ink); }

.checks-grp { display: flex; flex-wrap: wrap; gap: 10px 28px; }
.ck-item { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--ink-2); cursor: pointer; }
.ck-item input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--ink); flex: none; }

.seg-ctrl { display: inline-flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 2px; gap: 2px; }
.seg-btn { padding: 6px 16px; border: none; background: transparent; font: inherit; font-size: 13px; font-weight: 500; color: var(--muted); border-radius: 6px; cursor: pointer; transition: all .1s ease; }
.seg-btn.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.06); }

.consent-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.consent-lbl { flex: 1; }
.consent-lbl strong { font-size: 14px; font-weight: 500; color: var(--ink-2); display: block; }
.consent-lbl span { font-size: 12px; color: var(--muted); }
.tog-sw { position: relative; width: 44px; height: 24px; background: var(--border-strong); border-radius: 100px; cursor: pointer; border: none; transition: background .15s ease; flex: none; }
.tog-sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: transform .15s ease; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.tog-sw.on { background: var(--ok); }
.tog-sw.on::after { transform: translateX(20px); }

.sig-area { margin-top: 14px; }
.sig-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sig-lbl-txt { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.065em; color: var(--muted-2); }
.sig-clear-btn { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted-2); background: none; border: none; cursor: pointer; padding: 3px 6px; border-radius: 5px; transition: color .1s; }
.sig-clear-btn:hover { color: var(--danger); }
.sig-canvas-wrap { border: 1.5px dashed var(--border-strong); border-radius: 10px; background: white; overflow: hidden; cursor: crosshair; }
.sig-canvas-wrap canvas { display: block; width: 100%; height: 130px; touch-action: none; }
.sig-hint { font-size: 11.5px; color: var(--muted-3); margin-top: 6px; font-style: italic; }

.adm-footer { display: flex; align-items: center; gap: 10px; padding: 18px 22px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface); }
.adm-footer .hint { margin-left: auto; font-size: 12px; color: var(--muted-2); }

.adm-view { display: flex; flex-direction: column; gap: 14px; }
.adm-view-hdr { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); }
.adm-view-title { font-size: 14px; font-weight: 600; color: var(--ink); }
.badge-completa { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 100px; background: var(--ok-soft); color: var(--ok); font-size: 11.5px; font-weight: 600; }
.badge-completa svg { width: 11px; height: 11px; stroke: currentColor; stroke-width: 2.5; fill: none; }
.v-sec { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; }
.v-sec-hd { padding: 12px 20px; background: var(--surface-2); border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted-2); display: flex; align-items: center; gap: 8px; }
.v-sec-hd svg { width: 13px; height: 13px; stroke: var(--muted-2); stroke-width: 1.8; fill: none; }
.v-sec-bd { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
.v-field .v-lbl { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.065em; color: var(--muted-2); margin-bottom: 5px; }
.v-field .v-val { font-size: 14px; color: var(--ink-2); line-height: 1.65; white-space: pre-wrap; }
.v-g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 28px; }
.v-table { width: 100%; border-collapse: collapse; }
.v-table th { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-2); padding: 0 16px 8px 0; text-align: left; border-bottom: 1px solid var(--border); }
.v-table td { padding: 9px 16px 9px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; color: var(--ink-2); vertical-align: top; }
.v-table tr:last-child td { border-bottom: none; }
.chips-view { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-v { padding: 4px 12px; border-radius: 100px; background: var(--surface-3); border: 1px solid var(--border); font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
.ok-row { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; color: var(--ok); }
.ok-row svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.5; fill: none; }

@media (max-width: 700px) {
  .f-g2, .v-g2 { grid-template-columns: 1fr; }
  .rep-row.trat, .rep-row.med { grid-template-columns: 1fr 28px; }
  .rep-row.trat .adm-inp:nth-child(2), .rep-row.trat .adm-inp:nth-child(3) { grid-column: 1; }
  .rep-row.med .adm-inp:nth-child(2), .rep-row.med .adm-inp:nth-child(3) { grid-column: 1; }
}
`

// ── Signature Canvas ───────────────────────────────────────────────────────────

function SignatureCanvas({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return
    drawing.current = true
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e, canvas)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0B1220'
    ctx.lineTo(x, y); ctx.stroke()
  }

  function endDraw() {
    drawing.current = false
    const canvas = canvasRef.current; if (!canvas) return
    onSave(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    onSave('')
  }

  return (
    <div className="sig-area">
      <div className="sig-head">
        <span className="sig-lbl-txt">Firma del paciente</span>
        <button type="button" className="sig-clear-btn" onClick={clear}>
          <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          Limpiar
        </button>
      </div>
      <div className="sig-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={600} height={130}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
      </div>
      <p className="sig-hint">Firmar con el dedo o mouse sobre el área de arriba.</p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const ABORDAJE_OPTS = ['Individual', 'Pareja', 'Familia', 'Grupo']
const PRESTACIONES_OPTS = ['Psicodiagnóstico', 'Orientación vocacional', 'Psicoprofilaxis', 'Otro']

type Phase = 'loading' | 'empty' | 'form' | 'view'

function emptyTrat(): TratamientoRow { return { periodo: '', tipo: '', motivo_fin: '' } }
function emptyMed(): MedicacionRow { return { indicada_por: '', medicamento: '', dosis: '' } }

export default function AdmisionTab({ pacienteId }: { pacienteId: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [saved, setSaved] = useState<AdmisionData | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // form state
  const [motivo, setMotivo] = useState('')
  const [derivadoPor, setDerivedoPor] = useState('')
  const [sintomatologia, setSintomatologia] = useState('')
  const [antecedentes, setAntecedentes] = useState('')
  const [tratamientos, setTratamientos] = useState<TratamientoRow[]>([])
  const [medicacion, setMedicacion] = useState<MedicacionRow[]>([])
  const [diagnostico, setDiagnostico] = useState('')
  const [codigoCie, setCodigoCie] = useState('')
  const [programa, setPrograma] = useState('')
  const [sesiones, setSesiones] = useState('')
  const [frecuencia, setFrecuencia] = useState('Semanal')
  const [abordaje, setAbordaje] = useState<string[]>([])
  const [prestaciones, setPrestaciones] = useState<string[]>([])
  const [duracion, setDuracion] = useState('')
  const [pronostico, setPronostico] = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [firmaDataUrl, setFirmaDataUrl] = useState('')

  useEffect(() => {
    fetch(`/api/admisiones/${pacienteId}`)
      .then(r => r.json())
      .then(({ data }: { data: AdmisionData | null }) => {
        if (data) { setSaved(data); populateForm(data); setPhase('view') }
        else setPhase('empty')
      })
      .catch(() => setPhase('empty'))
  }, [pacienteId])

  function populateForm(d: AdmisionData) {
    setMotivo(d.motivo_consulta ?? '')
    setDerivedoPor(d.derivado_por ?? '')
    setSintomatologia(d.sintomatologia ?? '')
    setAntecedentes(d.antecedentes ?? '')
    setTratamientos(d.tratamientos_anteriores ?? [])
    setMedicacion(d.medicacion_actual ?? [])
    setDiagnostico(d.diagnostico ?? '')
    setCodigoCie(d.codigo_cie ?? '')
    setPrograma(d.programa_marco_teorico ?? '')
    setSesiones(d.sesiones_estimadas != null ? String(d.sesiones_estimadas) : '')
    setFrecuencia(d.frecuencia ?? 'Semanal')
    setAbordaje(d.abordaje ?? [])
    setPrestaciones(d.otras_prestaciones ?? [])
    setDuracion(d.duracion_estimada ?? '')
    setPronostico(d.pronostico ?? '')
    setConsentimiento(d.consentimiento_informado ?? false)
    setFirmaDataUrl(d.firma_paciente_url ?? '')
  }

  function toggleAbordaje(v: string) {
    setAbordaje(a => a.includes(v) ? a.filter(x => x !== v) : [...a, v])
  }
  function togglePrestacion(v: string) {
    setPrestaciones(a => a.includes(v) ? a.filter(x => x !== v) : [...a, v])
  }

  async function handleGuardar() {
    setSaving(true); setError(null)
    const body: AdmisionData = {
      motivo_consulta: motivo || null as never,
      derivado_por: derivadoPor || null as never,
      sintomatologia: sintomatologia || null as never,
      antecedentes: antecedentes || null as never,
      tratamientos_anteriores: tratamientos,
      medicacion_actual: medicacion,
      diagnostico: diagnostico || null as never,
      codigo_cie: codigoCie || null as never,
      programa_marco_teorico: programa || null as never,
      sesiones_estimadas: sesiones ? Number(sesiones) : null,
      frecuencia,
      abordaje,
      otras_prestaciones: prestaciones,
      duracion_estimada: duracion || null as never,
      pronostico: pronostico || null as never,
      consentimiento_informado: consentimiento,
      firma_paciente_url: firmaDataUrl || null as never,
    }
    try {
      const res = await fetch(`/api/admisiones/${pacienteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok?: boolean; data?: AdmisionData; error?: string }
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      setSaved(json.data ?? null)
      setPhase('view')
    } catch {
      setError('Error al guardar la admisión')
    } finally {
      setSaving(false)
    }
  }

  function fmtDate(d?: string) {
    if (!d) return '—'
    try { return format(parseISO(d), "d 'de' MMMM 'de' yyyy", { locale: es }) }
    catch { return d }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <>
        <style>{css}</style>
        <div className="adm-wrap">
          <p style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--muted)' }}>Cargando admisión...</p>
        </div>
      </>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (phase === 'empty') {
    return (
      <>
        <style>{css}</style>
        <div className="adm-wrap">
          <div className="adm-empty">
            <div className="adm-empty-icon">
              <svg viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
            </div>
            <h3>Esta admisión está pendiente de completar</h3>
            <p>El formulario de admisión documenta el motivo de consulta, antecedentes, diagnóstico presuntivo, plan de tratamiento y consentimiento informado.</p>
            <span className="adm-fepra">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Estándar FEPRA
            </span>
            <button type="button" className="btn-primary" style={{ marginTop: 4 }} onClick={() => setPhase('form')}>
              Completar admisión
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  if (phase === 'form') {
    return (
      <>
        <style>{css}</style>
        <div className="adm-wrap">
          <div className="adm-form">

            {/* S1 — Motivo */}
            <div className="adm-sec">
              <div className="adm-sec-hd">
                <span className="sec-num">1</span>
                <span className="sec-title">Motivo de consulta</span>
              </div>
              <div className="adm-sec-bd">
                <div className="f-field">
                  <label className="f-label">Motivo de consulta</label>
                  <textarea className="adm-ta tall" placeholder="Describí el motivo por el que consulta el paciente..." value={motivo} onChange={e => setMotivo(e.target.value)} />
                </div>
                <div className="f-field">
                  <label className="f-label">Derivado por <span className="f-opt">opcional</span></label>
                  <input type="text" className="adm-inp" placeholder="Médico clínico, institución, familiar..." value={derivadoPor} onChange={e => setDerivedoPor(e.target.value)} />
                </div>
              </div>
            </div>

            {/* S2 — Antecedentes */}
            <div className="adm-sec">
              <div className="adm-sec-hd">
                <span className="sec-num">2</span>
                <span className="sec-title">Antecedentes clínicos</span>
              </div>
              <div className="adm-sec-bd">
                <div className="f-field">
                  <label className="f-label">Sintomatología actual</label>
                  <textarea className="adm-ta" placeholder="Describí los síntomas actuales..." value={sintomatologia} onChange={e => setSintomatologia(e.target.value)} />
                </div>
                <div className="f-field">
                  <label className="f-label">Antecedentes de la situación actual</label>
                  <textarea className="adm-ta" placeholder="Historial relevante, situaciones previas..." value={antecedentes} onChange={e => setAntecedentes(e.target.value)} />
                </div>

                <div className="f-field">
                  <label className="f-label">Tratamientos anteriores <span className="f-opt">opcional</span></label>
                  <div className="rep-list">
                    {tratamientos.map((t, i) => (
                      <div key={i} className="rep-row trat">
                        <input className="adm-inp" placeholder="Año/Período" value={t.periodo} onChange={e => setTratamientos(rows => rows.map((r, j) => j === i ? { ...r, periodo: e.target.value } : r))} />
                        <input className="adm-inp" placeholder="Tipo de tratamiento" value={t.tipo} onChange={e => setTratamientos(rows => rows.map((r, j) => j === i ? { ...r, tipo: e.target.value } : r))} />
                        <input className="adm-inp" placeholder="Motivo de finalización" value={t.motivo_fin} onChange={e => setTratamientos(rows => rows.map((r, j) => j === i ? { ...r, motivo_fin: e.target.value } : r))} />
                        <button type="button" className="rep-del" onClick={() => setTratamientos(rows => rows.filter((_, j) => j !== i))}>
                          <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="rep-add" onClick={() => setTratamientos(r => [...r, emptyTrat()])}>
                    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar tratamiento
                  </button>
                </div>

                <div className="f-field">
                  <label className="f-label">Medicación actual <span className="f-opt">opcional</span></label>
                  <div className="rep-list">
                    {medicacion.map((m, i) => (
                      <div key={i} className="rep-row med">
                        <input className="adm-inp" placeholder="Indicada por" value={m.indicada_por} onChange={e => setMedicacion(rows => rows.map((r, j) => j === i ? { ...r, indicada_por: e.target.value } : r))} />
                        <input className="adm-inp" placeholder="Medicamento" value={m.medicamento} onChange={e => setMedicacion(rows => rows.map((r, j) => j === i ? { ...r, medicamento: e.target.value } : r))} />
                        <input className="adm-inp" placeholder="Dosis" value={m.dosis} onChange={e => setMedicacion(rows => rows.map((r, j) => j === i ? { ...r, dosis: e.target.value } : r))} />
                        <button type="button" className="rep-del" onClick={() => setMedicacion(rows => rows.filter((_, j) => j !== i))}>
                          <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="rep-add" onClick={() => setMedicacion(r => [...r, emptyMed()])}>
                    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar medicación
                  </button>
                </div>
              </div>
            </div>

            {/* S3 — Diagnóstico */}
            <div className="adm-sec">
              <div className="adm-sec-hd">
                <span className="sec-num">3</span>
                <span className="sec-title">Diagnóstico presuntivo</span>
              </div>
              <div className="adm-sec-bd">
                <div className="f-field">
                  <label className="f-label">Diagnóstico</label>
                  <textarea className="adm-ta" placeholder="Describí el diagnóstico presuntivo..." value={diagnostico} onChange={e => setDiagnostico(e.target.value)} />
                </div>
                <div className="f-field" style={{ maxWidth: 320 }}>
                  <label className="f-label">Código CIE-10 / DSM-5 <span className="f-opt">opcional</span></label>
                  <input type="text" className="adm-inp" placeholder="Ej: F41.1" value={codigoCie} onChange={e => setCodigoCie(e.target.value)} />
                </div>
              </div>
            </div>

            {/* S4 — Plan */}
            <div className="adm-sec">
              <div className="adm-sec-hd">
                <span className="sec-num">4</span>
                <span className="sec-title">Plan de tratamiento</span>
              </div>
              <div className="adm-sec-bd">
                <div className="f-field">
                  <label className="f-label">Programa y marco teórico</label>
                  <textarea className="adm-ta" placeholder="Describí el enfoque terapéutico y marco teórico..." value={programa} onChange={e => setPrograma(e.target.value)} />
                </div>
                <div className="f-g2">
                  <div className="f-field">
                    <label className="f-label">Sesiones estimadas</label>
                    <input type="number" min="1" className="adm-inp" placeholder="Ej: 24" value={sesiones} onChange={e => setSesiones(e.target.value)} />
                  </div>
                  <div className="f-field">
                    <label className="f-label">Frecuencia</label>
                    <div className="seg-ctrl">
                      {['Semanal', 'Quincenal', 'Otro'].map(f => (
                        <button key={f} type="button" className={`seg-btn${frecuencia === f ? ' on' : ''}`} onClick={() => setFrecuencia(f)}>{f}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="f-field">
                  <label className="f-label">Abordaje</label>
                  <div className="chips-grp">
                    {ABORDAJE_OPTS.map(o => (
                      <button key={o} type="button" className={`chip-tog${abordaje.includes(o) ? ' on' : ''}`} onClick={() => toggleAbordaje(o)}>{o}</button>
                    ))}
                  </div>
                </div>
                <div className="f-field">
                  <label className="f-label">Otras prestaciones <span className="f-opt">opcional</span></label>
                  <div className="checks-grp">
                    {PRESTACIONES_OPTS.map(o => (
                      <label key={o} className="ck-item">
                        <input type="checkbox" checked={prestaciones.includes(o)} onChange={() => togglePrestacion(o)} />
                        {o}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="f-field">
                  <label className="f-label">Duración estimada del tratamiento <span className="f-opt">opcional</span></label>
                  <input type="text" className="adm-inp" placeholder="Ej: 6 meses, 1 año..." value={duracion} onChange={e => setDuracion(e.target.value)} />
                </div>
                <div className="f-field">
                  <label className="f-label">Pronóstico <span className="f-opt">opcional</span></label>
                  <textarea className="adm-ta" placeholder="Pronóstico esperado del tratamiento..." value={pronostico} onChange={e => setPronostico(e.target.value)} />
                </div>
              </div>
            </div>

            {/* S5 — Consentimiento */}
            <div className="adm-sec">
              <div className="adm-sec-hd">
                <span className="sec-num">5</span>
                <span className="sec-title">Consentimiento informado</span>
              </div>
              <div className="adm-sec-bd">
                <div className="consent-row">
                  <div className="consent-lbl">
                    <strong>El paciente otorgó su consentimiento informado</strong>
                    <span>Conforme a la Ley 26.529 de Derechos del Paciente</span>
                  </div>
                  <button type="button" className={`tog-sw${consentimiento ? ' on' : ''}`} onClick={() => setConsentimiento(v => !v)} />
                </div>
                {consentimiento && (
                  <SignatureCanvas onSave={setFirmaDataUrl} />
                )}
              </div>
            </div>

            {/* Footer */}
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>
            )}
            <div className="adm-footer">
              <button type="button" className="btn-secondary" onClick={() => setPhase(saved ? 'view' : 'empty')}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={saving} style={saving ? { opacity: 0.7 } : {}} onClick={handleGuardar}>
                {saving ? 'Guardando...' : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Guardar admisión
                  </span>
                )}
              </button>
              <span className="hint">Los datos se guardan en la historia clínica del paciente.</span>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── View ─────────────────────────────────────────────────────────────────────
  const d = saved!
  return (
    <>
      <style>{css}</style>
      <div className="adm-wrap">
        <div className="adm-view">
          <div className="adm-view-hdr">
            <span className="adm-view-title">Admisión</span>
            <span className="badge-completa">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Completa · {fmtDate(d.updated_at ?? d.created_at)}
            </span>
            <button type="button" className="btn-secondary" style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px' }} onClick={() => { populateForm(d); setPhase('form') }}>
              Editar
            </button>
          </div>

          {/* V1 — Motivo */}
          {(d.motivo_consulta || d.derivado_por) && (
            <div className="v-sec">
              <div className="v-sec-hd">
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Motivo de consulta
              </div>
              <div className="v-sec-bd">
                {d.motivo_consulta && <div className="v-field"><div className="v-lbl">Motivo</div><div className="v-val">{d.motivo_consulta}</div></div>}
                {d.derivado_por && <div className="v-field"><div className="v-lbl">Derivado por</div><div className="v-val">{d.derivado_por}</div></div>}
              </div>
            </div>
          )}

          {/* V2 — Antecedentes */}
          {(d.sintomatologia || d.antecedentes || (d.tratamientos_anteriores?.length ?? 0) > 0 || (d.medicacion_actual?.length ?? 0) > 0) && (
            <div className="v-sec">
              <div className="v-sec-hd">
                <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Antecedentes clínicos
              </div>
              <div className="v-sec-bd">
                {d.sintomatologia && <div className="v-field"><div className="v-lbl">Sintomatología actual</div><div className="v-val">{d.sintomatologia}</div></div>}
                {d.antecedentes && <div className="v-field"><div className="v-lbl">Antecedentes</div><div className="v-val">{d.antecedentes}</div></div>}
                {(d.tratamientos_anteriores?.length ?? 0) > 0 && (
                  <div className="v-field">
                    <div className="v-lbl">Tratamientos anteriores</div>
                    <table className="v-table">
                      <thead><tr><th>Período</th><th>Tipo</th><th>Motivo finalización</th></tr></thead>
                      <tbody>{d.tratamientos_anteriores!.map((t, i) => <tr key={i}><td>{t.periodo || '—'}</td><td>{t.tipo || '—'}</td><td>{t.motivo_fin || '—'}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                {(d.medicacion_actual?.length ?? 0) > 0 && (
                  <div className="v-field">
                    <div className="v-lbl">Medicación actual</div>
                    <table className="v-table">
                      <thead><tr><th>Indicada por</th><th>Medicamento</th><th>Dosis</th></tr></thead>
                      <tbody>{d.medicacion_actual!.map((m, i) => <tr key={i}><td>{m.indicada_por || '—'}</td><td>{m.medicamento || '—'}</td><td>{m.dosis || '—'}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* V3 — Diagnóstico */}
          {(d.diagnostico || d.codigo_cie) && (
            <div className="v-sec">
              <div className="v-sec-hd">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Diagnóstico presuntivo
              </div>
              <div className="v-sec-bd">
                {d.diagnostico && <div className="v-field"><div className="v-lbl">Diagnóstico</div><div className="v-val">{d.diagnostico}</div></div>}
                {d.codigo_cie && <div className="v-field"><div className="v-lbl">Código CIE-10 / DSM-5</div><div className="v-val">{d.codigo_cie}</div></div>}
              </div>
            </div>
          )}

          {/* V4 — Plan */}
          {(d.programa_marco_teorico || d.sesiones_estimadas || (d.abordaje?.length ?? 0) > 0 || (d.otras_prestaciones?.length ?? 0) > 0 || d.duracion_estimada || d.pronostico) && (
            <div className="v-sec">
              <div className="v-sec-hd">
                <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                Plan de tratamiento
              </div>
              <div className="v-sec-bd">
                {d.programa_marco_teorico && <div className="v-field"><div className="v-lbl">Programa y marco teórico</div><div className="v-val">{d.programa_marco_teorico}</div></div>}
                <div className="v-g2">
                  {d.sesiones_estimadas != null && <div className="v-field"><div className="v-lbl">Sesiones estimadas</div><div className="v-val">{d.sesiones_estimadas}</div></div>}
                  {d.frecuencia && <div className="v-field"><div className="v-lbl">Frecuencia</div><div className="v-val">{d.frecuencia}</div></div>}
                </div>
                {(d.abordaje?.length ?? 0) > 0 && (
                  <div className="v-field">
                    <div className="v-lbl">Abordaje</div>
                    <div className="chips-view">{d.abordaje!.map(a => <span key={a} className="chip-v">{a}</span>)}</div>
                  </div>
                )}
                {(d.otras_prestaciones?.length ?? 0) > 0 && (
                  <div className="v-field">
                    <div className="v-lbl">Otras prestaciones</div>
                    <div className="chips-view">{d.otras_prestaciones!.map(p => <span key={p} className="chip-v">{p}</span>)}</div>
                  </div>
                )}
                {d.duracion_estimada && <div className="v-field"><div className="v-lbl">Duración estimada</div><div className="v-val">{d.duracion_estimada}</div></div>}
                {d.pronostico && <div className="v-field"><div className="v-lbl">Pronóstico</div><div className="v-val">{d.pronostico}</div></div>}
              </div>
            </div>
          )}

          {/* V5 — Consentimiento */}
          <div className="v-sec">
            <div className="v-sec-hd">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Consentimiento informado
            </div>
            <div className="v-sec-bd">
              {d.consentimiento_informado ? (
                <div className="ok-row">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  Consentimiento otorgado
                </div>
              ) : (
                <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Sin consentimiento registrado.</p>
              )}
              {d.firma_paciente_url && (
                <div className="v-field">
                  <div className="v-lbl">Firma del paciente</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxWidth: 320 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.firma_paciente_url} alt="Firma del paciente" style={{ display: 'block', width: '100%', background: 'white' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
