'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SlideOver from '@/components/ui/SlideOver'
import type { MenuSemanalItem } from '@/types/database'

interface Props {
  pacienteId: string
  open: boolean
  onClose: () => void
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const COMIDAS = ['Desayuno', 'Almuerzo', 'Merienda', 'Cena']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function mondayOf(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function fmtRange(start: Date): string {
  const end = addDays(start, 6)
  if (start.getMonth() === end.getMonth()) {
    return `Semana del ${start.getDate()} al ${end.getDate()} de ${MESES[start.getMonth()]}`
  }
  return `Semana del ${start.getDate()} de ${MESES[start.getMonth()]} al ${end.getDate()} de ${MESES[end.getMonth()]}`
}

type Semana = Record<string, Record<string, string>> // { [dia]: { [comida]: texto } }

function semanaVacia(): Semana {
  const s: Semana = {}
  DIAS.forEach((d) => { s[d] = {} })
  return s
}

export default function SlideOverMenuSemanal({ pacienteId, open, onClose }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const [semana, setSemana] = useState<Semana>(semanaVacia())
  const [loading, setLoading] = useState(true)
  const [duplicando, setDuplicando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelado = false
    async function fetchSemana() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('menu_semanal')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('semana_inicio', toDateKey(weekStart))
      if (cancelado) return
      const s = semanaVacia()
      ;(data as MenuSemanalItem[] ?? []).forEach((row) => {
        if (!s[row.dia]) s[row.dia] = {}
        s[row.dia][row.comida] = row.descripcion ?? ''
      })
      setSemana(s)
      setLoading(false)
    }
    fetchSemana()
    return () => { cancelado = true }
  }, [pacienteId, open, weekStart])

  async function guardarCelda(dia: string, comida: string, valor: string, checkEl: HTMLSpanElement | null) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('menu_semanal').upsert({
      terapeuta_id: user.id,
      paciente_id: pacienteId,
      semana_inicio: toDateKey(weekStart),
      dia,
      comida,
      descripcion: valor || null,
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'paciente_id,semana_inicio,dia,comida' })
    if (checkEl) {
      checkEl.classList.add('show')
      window.setTimeout(() => checkEl.classList.remove('show'), 1000)
    }
  }

  async function duplicarSemanaAnterior() {
    setDuplicando(true)
    setAviso(null)
    const semanaAnteriorInicio = toDateKey(addDays(weekStart, -7))
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDuplicando(false); return }
    const { data } = await supabase
      .from('menu_semanal')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('semana_inicio', semanaAnteriorInicio)
    const filas = (data as MenuSemanalItem[]) ?? []
    if (filas.length === 0) {
      setAviso('No hay datos cargados en la semana anterior.')
      setDuplicando(false)
      return
    }
    const inserts = filas.map((f) => ({
      terapeuta_id: user.id,
      paciente_id: pacienteId,
      semana_inicio: toDateKey(weekStart),
      dia: f.dia,
      comida: f.comida,
      descripcion: f.descripcion,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('menu_semanal').upsert(inserts as never, { onConflict: 'paciente_id,semana_inicio,dia,comida' })
    const s = semanaVacia()
    filas.forEach((f) => {
      if (!s[f.dia]) s[f.dia] = {}
      s[f.dia][f.comida] = f.descripcion ?? ''
    })
    setSemana(s)
    setDuplicando(false)
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Menú semanal"
      width="xl"
      header={
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border, #E7E9EE)', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--ink, #0B1220)' }}>Menú semanal</h2>
            <div style={{ fontSize: 12, color: 'var(--muted, #5B6472)', marginTop: 2 }}>Plan de comidas del paciente</div>
          </div>
          <button
            type="button"
            onClick={duplicarSemanaAnterior}
            disabled={duplicando}
            className="btn-secondary"
            style={{ fontSize: 12.5, whiteSpace: 'nowrap', marginLeft: 'auto', flex: 'none', opacity: duplicando ? 0.6 : 1 }}
          >
            {duplicando ? 'Duplicando...' : 'Duplicar semana anterior'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'var(--ink-2, #1F2937)', strokeWidth: 1.8, fill: 'none' }}>
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        </div>
      }
      footer={
        <div style={{ borderTop: '1px solid var(--border, #E7E9EE)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2, #F6F7F9)', fontSize: 11.5, color: 'var(--muted-2, #8A93A1)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ok, #0E8A5F)', display: 'inline-block' }} />
          Guardado automático por celda
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setWeekStart((w) => addDays(w, -7))} style={weekArrowStyle} title="Semana anterior">
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--ink-2, #1F2937)', strokeWidth: 2, fill: 'none' }}><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink, #0B1220)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
          {fmtRange(weekStart)}
        </div>
        <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))} style={weekArrowStyle} title="Semana siguiente">
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--ink-2, #1F2937)', strokeWidth: 2, fill: 'none' }}><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      {aviso && (
        <div style={{ fontSize: 12.5, color: 'var(--warn, #A65A06)', background: 'var(--warn-soft, #FBF1E2)', border: '1px solid var(--warn, #A65A06)', borderRadius: 'var(--r-md, 8px)', padding: '8px 12px', marginBottom: 12 }}>
          {aviso}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted, #8A93A1)' }}>Cargando...</p>
      ) : (
        <>
          {/* Grid desktop */}
          <div
            className="menu-grid-desktop"
            style={{
              display: 'grid',
              gridTemplateColumns: '90px repeat(7, minmax(120px, 1fr))',
              border: '1px solid var(--border, #E7E9EE)',
              borderRadius: 'var(--r-lg, 12px)',
              overflow: 'hidden',
              background: 'var(--surface, #fff)',
            }}
          >
            <div style={mgHeadStyle} />
            {DIAS.map((dia, i) => (
              <div key={dia} style={mgHeadStyle}>
                <span style={{ display: 'block' }}>{dia}</span>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--muted-3, #AEB5C0)', marginTop: 1 }}>
                  {addDays(weekStart, i).getDate()}
                </span>
              </div>
            ))}
            {COMIDAS.map((comida) => (
              <RowComida key={comida} comida={comida} dias={DIAS} semana={semana} setSemana={setSemana} guardarCelda={guardarCelda} />
            ))}
          </div>

          {/* Acordeón mobile */}
          <div className="menu-grid-mobile" style={{ display: 'none', flexDirection: 'column', gap: 8 }}>
            {DIAS.map((dia, i) => (
              <DayAccordionItem key={dia} dia={dia} dateNum={addDays(weekStart, i).getDate()} mes={MESES[addDays(weekStart, i).getMonth()]} defaultOpen={i === 0} semana={semana} setSemana={setSemana} guardarCelda={guardarCelda} />
            ))}
          </div>

          <style jsx>{`
            @media (max-width: 720px) {
              .menu-grid-desktop { display: none !important; }
              .menu-grid-mobile { display: flex !important; }
            }
          `}</style>
        </>
      )}
    </SlideOver>
  )
}

const weekArrowStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 7,
  border: '1px solid var(--border, #E7E9EE)',
  background: 'var(--surface, #fff)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  flex: 'none',
}

const mgHeadStyle: React.CSSProperties = {
  background: 'var(--surface-2, #F6F7F9)',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--muted-2, #8A93A1)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  padding: '10px 8px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  borderRight: '1px solid var(--border, #E7E9EE)',
  borderBottom: '1px solid var(--border, #E7E9EE)',
}

function RowComida({
  comida, dias, semana, setSemana, guardarCelda,
}: {
  comida: string
  dias: string[]
  semana: Semana
  setSemana: React.Dispatch<React.SetStateAction<Semana>>
  guardarCelda: (dia: string, comida: string, valor: string, checkEl: HTMLSpanElement | null) => void
}) {
  return (
    <>
      <div
        style={{
          background: 'var(--surface-2, #F6F7F9)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2, #1F2937)',
          display: 'flex', alignItems: 'center', padding: '10px 10px',
          borderRight: '1px solid var(--border, #E7E9EE)', borderBottom: '1px solid var(--border, #E7E9EE)',
        }}
      >
        {comida}
      </div>
      {dias.map((dia) => (
        <CeldaMenu
          key={dia}
          dia={dia}
          comida={comida}
          valor={semana[dia]?.[comida] ?? ''}
          onChange={(v) => setSemana((s) => ({ ...s, [dia]: { ...s[dia], [comida]: v } }))}
          onSave={guardarCelda}
        />
      ))}
    </>
  )
}

function CeldaMenu({
  dia, comida, valor, onChange, onSave, compact,
}: {
  dia: string
  comida: string
  valor: string
  onChange: (v: string) => void
  onSave: (dia: string, comida: string, valor: string, checkEl: HTMLSpanElement | null) => void
  compact?: boolean
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const checkRef = useRef<HTMLSpanElement>(null)

  function autoGrow() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, compact ? 52 : 44) + 'px'
  }

  useEffect(() => { autoGrow() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={compact ? { padding: '6px 0' } : { padding: 6, borderRight: '1px solid var(--border, #E7E9EE)', borderBottom: '1px solid var(--border, #E7E9EE)' }}>
      <div style={{ position: 'relative' }}>
        <textarea
          ref={taRef}
          className="celda-menu-textarea"
          placeholder="Agregar..."
          value={valor}
          onChange={(e) => { onChange(e.target.value); autoGrow() }}
          onBlur={() => onSave(dia, comida, valor, checkRef.current)}
          style={{
            width: '100%', minHeight: compact ? 52 : 44, resize: 'none', overflow: 'hidden',
            border: compact ? '1px solid var(--border, #E7E9EE)' : '1px solid transparent',
            borderRadius: 'var(--r-sm, 6px)',
            padding: compact ? '8px 26px 8px 10px' : '6px 24px 6px 7px',
            fontSize: 12.5, lineHeight: 1.4, color: 'var(--ink, #0B1220)',
            background: compact ? 'var(--surface, #fff)' : 'transparent', outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--accent, #1F4FD9)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft, #EAF0FE)'; e.target.style.background = 'var(--surface, #fff)' }}
          onBlurCapture={(e) => { e.target.style.borderColor = compact ? 'var(--border, #E7E9EE)' : 'transparent'; e.target.style.boxShadow = 'none'; if (!compact) e.target.style.background = 'transparent' }}
        />
        <span ref={checkRef} className="cell-check-icon" style={{ position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: '50%', background: 'var(--ok-soft, #E7F5EE)', display: 'grid', placeItems: 'center', opacity: 0, transform: 'scale(.6)', transition: 'opacity .15s ease, transform .15s ease', pointerEvents: 'none' }}>
          <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: 'var(--ok, #0E8A5F)', strokeWidth: 2.6, fill: 'none' }}><path d="M20 6L9 17l-5-5" /></svg>
        </span>
        <style jsx>{`
          .cell-check-icon.show {
            opacity: 1 !important;
            transform: scale(1) !important;
          }
        `}</style>
      </div>
    </div>
  )
}

function DayAccordionItem({
  dia, dateNum, mes, defaultOpen, semana, setSemana, guardarCelda,
}: {
  dia: string
  dateNum: number
  mes: string
  defaultOpen: boolean
  semana: Semana
  setSemana: React.Dispatch<React.SetStateAction<Semana>>
  guardarCelda: (dia: string, comida: string, valor: string, checkEl: HTMLSpanElement | null) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid var(--border, #E7E9EE)', borderRadius: 'var(--r-lg, 12px)', overflow: 'hidden', background: 'var(--surface, #fff)' }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', background: 'var(--surface-2, #F6F7F9)' }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink, #0B1220)', flex: 1 }}>{dia}</span>
        <span style={{ fontSize: 11.5, color: 'var(--muted-2, #8A93A1)' }}>{dateNum} de {mes}</span>
        <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, stroke: 'var(--muted-2, #8A93A1)', strokeWidth: 2, fill: 'none', transition: 'transform .15s ease', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px 14px' }}>
          {COMIDAS.map((comida) => (
            <div key={comida} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-2, #8A93A1)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{comida}</label>
              <CeldaMenu
                dia={dia}
                comida={comida}
                valor={semana[dia]?.[comida] ?? ''}
                onChange={(v) => setSemana((s) => ({ ...s, [dia]: { ...s[dia], [comida]: v } }))}
                onSave={guardarCelda}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
