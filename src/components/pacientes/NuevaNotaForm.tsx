'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import RichTextEditor from '@/components/ui/RichTextEditor'
import VoiceRecorder from '@/components/ui/VoiceRecorder'

function isHtmlEmpty(html: string): boolean {
  return !html.replace(/<[^>]*>/g, '').trim()
}

interface Props {
  pacienteId: string
  turnoId?: string
  modoInicial?: 'texto' | 'voz'
  tieneVoz?: boolean
  onCreada?: () => void
  onClose?: () => void
}

export default function NuevaNotaForm({ pacienteId, turnoId, modoInicial = 'texto', tieneVoz = false, onCreada, onClose }: Props) {
  const [modo, setModo] = useState<'texto' | 'voz'>(modoInicial)
  const [contenido, setContenido] = useState('')
  const [fecha, setFecha] = useState('')
  const [maxSeconds, setMaxSeconds] = useState(300)
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)

  useEffect(() => { setFecha(format(new Date(), 'yyyy-MM-dd')) }, [])

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
