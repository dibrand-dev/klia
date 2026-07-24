'use client'

import { useState, useEffect } from 'react'
import { format, differenceInYears } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import RichTextEditor from '@/components/ui/RichTextEditor'
import VoiceRecorder from '@/components/ui/VoiceRecorder'
import StickyWidgetAntropometria from '@/components/nutricion/StickyWidgetAntropometria'

function isHtmlEmpty(html: string): boolean {
  return !html.replace(/<[^>]*>/g, '').trim()
}

function num(v: string): number | null {
  return v.trim() === '' ? null : Number(v)
}

function AntropoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="anthro-grid">
      {children}
      <style jsx>{`
        .anthro-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px 14px;
        }
        @media (max-width: 460px) {
          .anthro-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  )
}

function AntropoInput({ label, unit, value, onChange, tabIndex }: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  tabIndex: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label
        style={{
          fontSize: 12,
          color: 'var(--ink, #0B1220)',
          opacity: 0.6,
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={tabIndex}
          className="antropo-num-input"
          style={{
            width: '100%',
            height: 36,
            padding: '0 30px 0 10px',
            fontSize: 13.5,
            border: '1px solid var(--border, #E7E9EE)',
            borderRadius: 'var(--r-md, 8px)',
            outline: 'none',
            background: 'var(--surface, #fff)',
            color: 'var(--ink, #0B1220)',
            fontVariantNumeric: 'tabular-nums',
            transition: 'border-color .12s ease, box-shadow .12s ease',
          }}
          onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px var(--accent-soft, #EAF0FE)'; e.target.style.borderColor = 'var(--accent, #1F4FD9)' }}
          onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border, #E7E9EE)' }}
        />
        <span
          style={{
            position: 'absolute',
            right: 9,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: 'var(--muted-2, #8A93A1)',
            fontWeight: 500,
            pointerEvents: 'none',
          }}
        >
          {unit}
        </span>
      </div>
      <style jsx>{`
        .antropo-num-input::-webkit-outer-spin-button,
        .antropo-num-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .antropo-num-input {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  )
}

function AntropometriaSection({ open, onToggle, title, children, nested }: {
  open: boolean
  onToggle: () => void
  title: string
  children: React.ReactNode
  nested?: boolean
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border, #E7E9EE)',
        borderRadius: 'var(--r-lg, 12px)',
        background: nested ? 'var(--surface-2, #F6F7F9)' : 'var(--surface, #fff)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: nested ? '10px 14px' : '13px 16px',
          background: nested ? 'transparent' : 'var(--surface-2, #F6F7F9)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--ink, #0B1220)',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
        <svg
          viewBox="0 0 24 24"
          style={{
            width: 16,
            height: 16,
            stroke: 'var(--muted-2, #8A93A1)',
            strokeWidth: 2,
            fill: 'none',
            flex: 'none',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s ease',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: 16, background: nested ? 'var(--surface, #fff)' : 'transparent' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function StickyWidgetAntropometriaBarraMobile(props: React.ComponentProps<typeof StickyWidgetAntropometria>) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        border: '1px solid var(--border, #E7E9EE)',
        borderRadius: 'var(--r-lg, 12px)',
        background: 'var(--surface, #fff)',
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink, #0B1220)',
        }}
      >
        IMC / GEB en vivo
        <span className="material-symbols-outlined" style={{ fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          expand_more
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <StickyWidgetAntropometria {...props} />
        </div>
      )}
    </div>
  )
}

interface Props {
  pacienteId: string
  turnoId?: string
  modoInicial?: 'texto' | 'voz'
  especialidad?: string | null
  tieneVoz?: boolean
  onCreada?: () => void
  onClose?: () => void
}

export default function NuevaNotaForm({ pacienteId, turnoId, modoInicial = 'texto', especialidad, tieneVoz = false, onCreada, onClose }: Props) {
  const [modo, setModo] = useState<'texto' | 'voz'>(modoInicial)
  const [contenido, setContenido] = useState('')
  const [fecha, setFecha] = useState('')
  const [maxSeconds, setMaxSeconds] = useState(300)
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)

  // Antropometría — solo visible para especialidad Nutricionista
  const esNutricionista = especialidad === 'Nutrición'
  const [edadPaciente, setEdadPaciente] = useState<number | null>(null)
  const [sexoPaciente, setSexoPaciente] = useState<'M' | 'F' | null>(null)
  const [antropoOpen, setAntropoOpen] = useState(true)
  const [pliegOpen, setPliegOpen] = useState(false)
  const [antropo, setAntropo] = useState({
    peso: '', altura: '', cintura: '', cadera: '',
    porcentajeGrasa: '', porcentajeMusculo: '',
    pliegueTricipital: '', pliegueSubescapular: '', pliegueSuprailiaco: '',
    perimetroBrazo: '', perimetroPierna: '',
  })

  useEffect(() => { setFecha(format(new Date(), 'yyyy-MM-dd')) }, [])

  useEffect(() => {
    async function fetchDatosPaciente() {
      const supabase = createClient()
      const { data: paciente } = await supabase
        .from('pacientes')
        .select('fecha_nacimiento, genero')
        .eq('id', pacienteId)
        .single()
      if (paciente?.fecha_nacimiento) setEdadPaciente(differenceInYears(new Date(), new Date(paciente.fecha_nacimiento)))
      if (paciente?.genero === 'M' || paciente?.genero === 'F') setSexoPaciente(paciente.genero)
    }
    if (pacienteId && esNutricionista) fetchDatosPaciente()
  }, [pacienteId, esNutricionista])

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await createClient()
          .from('configuracion_global')
          .select('voz_duracion_max_segundos')
          .eq('id', 1)
          .single()
        if (data?.voz_duracion_max_segundos) setMaxSeconds(Number(data.voz_duracion_max_segundos))
      } catch {
        // fallback to default 300
      }
    }
    fetchConfig()
  }, [])

  // Load existing draft for this patient+turno on mount
  useEffect(() => {
    async function cargarBorrador() {
      if (!pacienteId) return
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const query = supabase
        .from('notas_clinicas')
        .select('id, contenido, fecha')
        .eq('terapeuta_id', user.id)
        .eq('paciente_id', pacienteId)
        .eq('borrador', true as never)
        .order('created_at', { ascending: false })
        .limit(1)
      if (turnoId) query.eq('turno_id', turnoId)
      const { data } = await query.maybeSingle()
      if (data) {
        const d = data as { id: string; contenido: string; fecha: string }
        setDraftId(d.id)
        setContenido(d.contenido)
        setFecha(d.fecha)
        setDraftSaved(true)
      }
    }
    cargarBorrador()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function autoGuardarBorrador(html: string, fechaActual: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('notas_clinicas').insert({
      terapeuta_id: user.id,
      paciente_id: pacienteId,
      turno_id: turnoId ?? null,
      fecha: fechaActual,
      contenido: html,
      borrador: true,
    } as never).select('id').single()
    if (data) {
      setDraftId((data as { id: string }).id)
      setDraftSaved(true)
    }
  }

  function handleTranscripcion(text: string) {
    const html = isHtmlEmpty(contenido) ? `<p>${text}</p>` : contenido + `<p>${text}</p>`
    setContenido(html)
    setModo('texto')
    setPendingText(null)
    autoGuardarBorrador(html, fecha || format(new Date(), 'yyyy-MM-dd'))
  }

  function aplicarPendiente(accion: 'append' | 'replace') {
    if (!pendingText) return
    const html = accion === 'append' ? contenido + `<p>${pendingText}</p>` : `<p>${pendingText}</p>`
    setContenido(html)
    setPendingText(null)
    setModo('texto')
  }

  async function handleGuardar() {
    if (isHtmlEmpty(contenido)) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const fechaFinal = fecha || format(new Date(), 'yyyy-MM-dd')

    if (draftId) {
      const { error: dbError } = await supabase.from('notas_clinicas')
        .update({ contenido, fecha: fechaFinal, borrador: false } as never)
        .eq('id', draftId)
      if (dbError) { setError('Error al guardar la nota. Intentá de nuevo.'); setLoading(false); return }
    } else {
      const { error: dbError } = await supabase.from('notas_clinicas').insert({
        terapeuta_id: user.id,
        paciente_id: pacienteId,
        turno_id: turnoId ?? null,
        fecha: fechaFinal,
        contenido,
        borrador: false,
      } as never)
      if (dbError) { setError('Error al guardar la nota. Intentá de nuevo.'); setLoading(false); return }
    }

    if (esNutricionista) {
      const antropoValues = {
        peso: num(antropo.peso),
        altura: num(antropo.altura),
        cintura: num(antropo.cintura),
        cadera: num(antropo.cadera),
        porcentaje_grasa: num(antropo.porcentajeGrasa),
        porcentaje_musculo: num(antropo.porcentajeMusculo),
        pliegue_tricipital: num(antropo.pliegueTricipital),
        pliegue_subescapular: num(antropo.pliegueSubescapular),
        pliegue_suprailiaco: num(antropo.pliegueSuprailiaco),
        perimetro_brazo: num(antropo.perimetroBrazo),
        perimetro_pierna: num(antropo.perimetroPierna),
      }
      const hayDatos = Object.values(antropoValues).some((v) => v != null)
      if (hayDatos) {
        const { error: antropoError } = await supabase.from('registros_antropometricos').insert({
          terapeuta_id: user.id,
          paciente_id: pacienteId,
          turno_id: turnoId ?? null,
          fecha: fechaFinal,
          ...antropoValues,
        } as never)
        if (antropoError) { setError('La nota se guardó, pero hubo un error al guardar los datos antropométricos.'); setLoading(false); return }
      }
    }

    onCreada?.()
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}

      {/* Mode toggle */}
      {tieneVoz && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setModo('texto')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', modo === 'texto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
            Escribir
          </button>
          <button
            type="button"
            onClick={() => setModo('voz')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', modo === 'voz' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mic</span>
            Voz
          </button>
        </div>
      )}

      {/* Pending transcription choice */}
      {pendingText && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-blue-900">Transcripción lista. ¿Qué hacemos con el texto existente?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => aplicarPendiente('append')}
              className="flex-1 py-2 text-sm font-medium bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Agregar al final
            </button>
            <button
              type="button"
              onClick={() => aplicarPendiente('replace')}
              className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reemplazar todo
            </button>
          </div>
        </div>
      )}

      {modo === 'voz' ? (
        <div className="card p-4">
          <VoiceRecorder
            onTranscription={handleTranscripcion}
            onError={(msg) => setError(msg)}
            maxSeconds={maxSeconds}
          />
        </div>
      ) : (
        <>
          <div className="card p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="input-field"
            />
          </div>

          {esNutricionista && (
            <>
              {/* Barra colapsable de cálculo en vivo — solo mobile/tablet */}
              <div className="lg:hidden">
                <StickyWidgetAntropometriaBarraMobile
                  pacienteId={pacienteId}
                  peso={num(antropo.peso)}
                  altura={num(antropo.altura)}
                  edad={edadPaciente}
                  sexo={sexoPaciente}
                />
              </div>

              <div className="lg:flex lg:gap-4 lg:items-start">
                <div className="flex-1 space-y-4">
                  <AntropometriaSection
                    open={antropoOpen}
                    onToggle={() => setAntropoOpen((v) => !v)}
                    title="Datos antropométricos"
                  >
                    <AntropoGrid>
                      <AntropoInput label="Peso" unit="kg" value={antropo.peso} onChange={(v) => setAntropo((p) => ({ ...p, peso: v }))} tabIndex={1} />
                      <AntropoInput label="Altura" unit="cm" value={antropo.altura} onChange={(v) => setAntropo((p) => ({ ...p, altura: v }))} tabIndex={2} />
                      <AntropoInput label="Cintura" unit="cm" value={antropo.cintura} onChange={(v) => setAntropo((p) => ({ ...p, cintura: v }))} tabIndex={3} />
                      <AntropoInput label="Cadera" unit="cm" value={antropo.cadera} onChange={(v) => setAntropo((p) => ({ ...p, cadera: v }))} tabIndex={4} />
                      <AntropoInput label="% Grasa" unit="%" value={antropo.porcentajeGrasa} onChange={(v) => setAntropo((p) => ({ ...p, porcentajeGrasa: v }))} tabIndex={5} />
                      <AntropoInput label="% Músculo" unit="%" value={antropo.porcentajeMusculo} onChange={(v) => setAntropo((p) => ({ ...p, porcentajeMusculo: v }))} tabIndex={6} />
                    </AntropoGrid>

                    <div style={{ marginTop: 14 }}>
                      <AntropometriaSection
                        open={pliegOpen}
                        onToggle={() => setPliegOpen((v) => !v)}
                        title="Pliegues cutáneos y perímetros"
                        nested
                      >
                        <AntropoGrid>
                          <AntropoInput label="Pliegue tricipital" unit="mm" value={antropo.pliegueTricipital} onChange={(v) => setAntropo((p) => ({ ...p, pliegueTricipital: v }))} tabIndex={7} />
                          <AntropoInput label="Pliegue subescapular" unit="mm" value={antropo.pliegueSubescapular} onChange={(v) => setAntropo((p) => ({ ...p, pliegueSubescapular: v }))} tabIndex={8} />
                          <AntropoInput label="Pliegue suprailíaco" unit="mm" value={antropo.pliegueSuprailiaco} onChange={(v) => setAntropo((p) => ({ ...p, pliegueSuprailiaco: v }))} tabIndex={9} />
                          <AntropoInput label="Perímetro de brazo" unit="cm" value={antropo.perimetroBrazo} onChange={(v) => setAntropo((p) => ({ ...p, perimetroBrazo: v }))} tabIndex={10} />
                          <AntropoInput label="Perímetro de pierna" unit="cm" value={antropo.perimetroPierna} onChange={(v) => setAntropo((p) => ({ ...p, perimetroPierna: v }))} tabIndex={11} />
                        </AntropoGrid>
                      </AntropometriaSection>
                    </div>
                  </AntropometriaSection>
                </div>

                {/* Widget sticky — solo desktop ancho */}
                <div className="hidden lg:block lg:w-64 lg:sticky lg:top-4 lg:flex-shrink-0">
                  <StickyWidgetAntropometria
                    pacienteId={pacienteId}
                    peso={num(antropo.peso)}
                    altura={num(antropo.altura)}
                    edad={edadPaciente}
                    sexo={sexoPaciente}
                  />
                </div>
              </div>
            </>
          )}

          <div className="card p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota de sesión</label>
            <RichTextEditor
              value={contenido}
              onChange={setContenido}
              placeholder="¿Qué trabajaron en esta sesión? Temas tratados, evolución, próximos pasos..."
              minHeight="220px"
            />
          </div>
        </>
      )}

      {draftSaved && (
        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          Borrador guardado — podés cerrar y continuar después sin perder el texto.
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onClose}
          className="btn-secondary flex-1 py-3 text-sm font-semibold"
        >
          Cancelar
        </button>
        {modo === 'texto' && (
          <button
            onClick={handleGuardar}
            disabled={loading || isHtmlEmpty(contenido)}
            className={cn('btn-primary flex-1 py-3', (loading || isHtmlEmpty(contenido)) && 'opacity-50')}
          >
            {loading ? 'Guardando...' : 'Guardar nota'}
          </button>
        )}
      </div>
    </div>
  )
}
