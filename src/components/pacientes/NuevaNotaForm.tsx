'use client'

import { useState, useEffect, useRef } from 'react'
import { format, differenceInYears } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/ui/RichTextEditor'
import VoiceRecorder from '@/components/ui/VoiceRecorder'
import { useEffectiveTerapeutaId } from '@/lib/auth/useEffectiveTerapeutaId'
import { getTerminologia } from '@/hooks/useTerminologia'
import '@/components/notas/nota-especialidad.css'
import ModuloEspecialidad, { tieneModulo } from '@/components/notas/ModuloEspecialidad'
import { notaPlaceholder, normalizarValoresModulo, type ValoresModulo } from '@/lib/notas/modulos'
import { guardarDatosModulo } from '@/lib/notas/persistencia'

function isHtmlEmpty(html: string): boolean {
  return !html.replace(/<[^>]*>/g, '').trim()
}

function hayDatosModulo(datos: ValoresModulo): boolean {
  return Object.values(datos).some((v) => {
    if (v == null || v === '') return false
    if (Array.isArray(v)) return v.length > 0
    return true
  })
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function metaHeader(turnoFechaHora: string | undefined): string {
  if (!turnoFechaHora) {
    const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })
    return `Nueva nota clínica · ${hoy}`
  }
  const d = new Date(turnoFechaHora)
  const dia = d.toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' })
  const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1)
  const diaMes = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).replace('.', '')
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
  return `Nueva nota clínica · ${diaCap} ${diaMes} · ${hora}`
}

interface Props {
  pacienteId: string
  turnoId?: string
  modoInicial?: 'texto' | 'voz'
  especialidad?: string | null
  tieneVoz?: boolean
  pacienteNombre?: string
  turnoFechaHora?: string
  terminologia?: 'sesion' | 'consulta' | null
  onCreada?: () => void
  onClose?: () => void
}

export default function NuevaNotaForm({ pacienteId, turnoId, modoInicial = 'texto', especialidad, tieneVoz = false, pacienteNombre, turnoFechaHora, terminologia, onCreada, onClose }: Props) {
  const { terapeutaId } = useEffectiveTerapeutaId()
  const [modo, setModo] = useState<'texto' | 'voz'>(modoInicial)
  const [contenido, setContenido] = useState('')
  const [fecha, setFecha] = useState('')
  const [maxSeconds, setMaxSeconds] = useState(300)
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [autosaveEstado, setAutosaveEstado] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [horaNotaBorrador, setHoraNotaBorrador] = useState<string | null>(null)
  const [horaGuardado, setHoraGuardado] = useState<string | null>(null)
  const [transcribiendo, setTranscribiendo] = useState(false)
  const [notaDeVoz, setNotaDeVoz] = useState<{ duracion: number } | null>(null)
  const ultimoGuardadoRef = useRef<string>('')
  const ultimoDatosModuloGuardadoRef = useRef<string>('{}')

  // Datos de los módulos por especialidad — se persisten en su tabla final
  // (registros_especialidad / registros_pio / etc.) solo al Guardar nota.
  // Mientras tanto viajan también en notas_clinicas.datos_modulo_borrador,
  // como respaldo del autoguardado (ver cargarBorrador / efecto de abajo).
  const esNutricionista = especialidad === 'Nutrición'
  const [edadPaciente, setEdadPaciente] = useState<number | null>(null)
  const [sexoPaciente, setSexoPaciente] = useState<'M' | 'F' | null>(null)
  const [datosModulo, setDatosModulo] = useState<ValoresModulo>({})

  function cambiarValorModulo(key: string, val: string | string[]) {
    setDatosModulo((p) => ({ ...p, [key]: val }))
  }

  const [pacienteNombreResuelto, setPacienteNombreResuelto] = useState<string | null>(null)
  useEffect(() => {
    if (pacienteNombre || !pacienteId) return
    const supabase = createClient()
    supabase
      .from('pacientes')
      .select('nombre, apellido')
      .eq('id', pacienteId)
      .single()
      .then(({ data }) => {
        if (data) setPacienteNombreResuelto(`${data.nombre} ${data.apellido}`)
      })
  }, [pacienteId, pacienteNombre])
  const nombreCargado = pacienteNombre ?? pacienteNombreResuelto
  const nombreMostrado = nombreCargado ?? 'Paciente'

  useEffect(() => {
    setFecha(
      turnoFechaHora
        ? new Date(turnoFechaHora).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
        : format(new Date(), 'yyyy-MM-dd')
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Load existing draft for this patient+turno on mount — y de nuevo cuando
  // terapeutaId termina de resolver (llega null en el primer render)
  useEffect(() => {
    async function cargarBorrador() {
      if (!pacienteId) return
      if (!terapeutaId) return
      const supabase = createClient()
      const query = supabase
        .from('notas_clinicas')
        .select('id, contenido, fecha, hora_nota, updated_at, datos_modulo_borrador')
        .eq('terapeuta_id', terapeutaId)
        .eq('paciente_id', pacienteId)
        .eq('borrador', true as never)
        .order('created_at', { ascending: false })
        .limit(1)
      if (turnoId) {
        query.eq('turno_id', turnoId)
      } else {
        query.is('turno_id', null)
      }
      const { data } = await query.maybeSingle()
      if (data) {
        const d = data as { id: string; contenido: string; fecha: string; hora_nota: string | null; updated_at: string; datos_modulo_borrador: Record<string, unknown> | null }
        const datosRestaurados = normalizarValoresModulo(d.datos_modulo_borrador)
        setDraftId(d.id)
        setContenido(d.contenido)
        setFecha(d.fecha)
        setHoraNotaBorrador(d.hora_nota)
        setHoraGuardado(d.updated_at)
        setDatosModulo(datosRestaurados)
        setAutosaveEstado('saved')
        // El contenido y los datos de módulo recién cargados ya están
        // persistidos — no re-disparar el autoguardado debounced por estos
        // mismos valores.
        ultimoGuardadoRef.current = d.contenido
        ultimoDatosModuloGuardadoRef.current = JSON.stringify(datosRestaurados)
      }
    }
    cargarBorrador()
  }, [terapeutaId])

  // Autoguardado real: debounce 1,5s sobre el contenido y/o los datos de
  // módulo. INSERT la primera vez (guarda draftId), UPDATE por draftId
  // después — nunca pisa hora_nota si el borrador ya la tiene.
  useEffect(() => {
    if (modo !== 'texto') return
    if (isHtmlEmpty(contenido) && !hayDatosModulo(datosModulo)) return
    const datosModuloStr = JSON.stringify(datosModulo)
    if (contenido === ultimoGuardadoRef.current && datosModuloStr === ultimoDatosModuloGuardadoRef.current) return
    if (!terapeutaId) return

    const timeout = setTimeout(async () => {
      setAutosaveEstado('saving')
      const supabase = createClient()
      const fechaActual = fecha || format(new Date(), 'yyyy-MM-dd')

      if (draftId) {
        const { error: dbError } = await supabase.from('notas_clinicas')
          .update({ contenido, fecha: fechaActual, datos_modulo_borrador: datosModulo } as never)
          .eq('id', draftId)
        if (!dbError) {
          ultimoGuardadoRef.current = contenido
          ultimoDatosModuloGuardadoRef.current = datosModuloStr
          setHoraGuardado(new Date().toISOString())
          setAutosaveEstado('saved')
        } else {
          setAutosaveEstado('idle')
        }
        return
      }

      const horaNota = new Date().toISOString()
      const { data } = await supabase.from('notas_clinicas').insert({
        terapeuta_id: terapeutaId,
        paciente_id: pacienteId,
        turno_id: turnoId ?? null,
        fecha: fechaActual,
        contenido,
        borrador: true,
        hora_nota: horaNota,
        datos_modulo_borrador: datosModulo,
      } as never).select('id').single()
      if (data) {
        setDraftId((data as { id: string }).id)
        setHoraNotaBorrador(horaNota)
        setHoraGuardado(horaNota)
        ultimoGuardadoRef.current = contenido
        ultimoDatosModuloGuardadoRef.current = datosModuloStr
        setAutosaveEstado('saved')
      } else {
        setAutosaveEstado('idle')
      }
    }, 1500)

    return () => clearTimeout(timeout)
  }, [contenido, datosModulo, modo, terapeutaId, draftId, fecha, pacienteId, turnoId])

  function handleTranscripcion(text: string, duracionSegundos?: number) {
    const html = isHtmlEmpty(contenido) ? `<p>${text}</p>` : contenido + `<p>${text}</p>`
    setContenido(html)
    setModo('texto')
    setPendingText(null)
    setNotaDeVoz(duracionSegundos != null ? { duracion: duracionSegundos } : null)
  }

  function handleContenidoChange(html: string) {
    setContenido(html)
    if (notaDeVoz) setNotaDeVoz(null)
  }

  function aplicarPendiente(accion: 'append' | 'replace') {
    if (!pendingText) return
    const html = accion === 'append' ? contenido + `<p>${pendingText}</p>` : `<p>${pendingText}</p>`
    setContenido(html)
    setPendingText(null)
    setModo('texto')
  }

  async function handleGuardar() {
    if (isHtmlEmpty(contenido) && !hayDatosModulo(datosModulo)) return
    if (!terapeutaId) {
      console.error('[NuevaNotaForm] terapeutaId no resuelto todavía')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const fechaFinal = fecha || format(new Date(), 'yyyy-MM-dd')
    let notaIdGuardada: string | null = null

    if (draftId) {
      const { error: dbError } = await supabase.from('notas_clinicas')
        .update({ contenido, fecha: fechaFinal, borrador: false, hora_nota: horaNotaBorrador ?? new Date().toISOString() } as never)
        .eq('id', draftId)
      if (dbError) { setError('Error al guardar la nota. Intentá de nuevo.'); setLoading(false); return }
      notaIdGuardada = draftId
    } else {
      const { data: notaCreada, error: dbError } = await supabase.from('notas_clinicas').insert({
        terapeuta_id: terapeutaId,
        paciente_id: pacienteId,
        turno_id: turnoId ?? null,
        fecha: fechaFinal,
        contenido,
        borrador: false,
        hora_nota: new Date().toISOString(),
      } as never).select('id').single()
      if (dbError) { setError('Error al guardar la nota. Intentá de nuevo.'); setLoading(false); return }
      notaIdGuardada = (notaCreada as { id: string } | null)?.id ?? null
    }

    if (tieneModulo(especialidad)) {
      const { error: moduloError } = await guardarDatosModulo({
        supabase, especialidad, valores: datosModulo,
        terapeutaId, pacienteId, turnoId: turnoId ?? null, fecha: fechaFinal, notaId: notaIdGuardada,
      })
      if (moduloError) { setError(moduloError); setLoading(false); return }
    }

    // El módulo ya quedó persistido en su tabla final (o no había nada que
    // persistir) — el respaldo de borrador en notas_clinicas ya no hace falta.
    if (notaIdGuardada) {
      await supabase.from('notas_clinicas')
        .update({ datos_modulo_borrador: null } as never)
        .eq('id', notaIdGuardada)
    }

    if (turnoId) {
      const { data: turnoActual } = await supabase
        .from('turnos')
        .select('estado_atencion')
        .eq('id', turnoId)
        .maybeSingle()
      const estadoActual = (turnoActual as { estado_atencion: string | null } | null)?.estado_atencion
      if (estadoActual !== 'en_consultorio' && estadoActual !== 'atendido') {
        fetch('/api/turnos/estado-atencion', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ turno_id: turnoId, estado_atencion: 'en_consultorio' }),
        }).catch(() => {})
      }
    }

    onCreada?.()
  }

  const t = getTerminologia(terminologia)

  return (
    <div className="nota-so">
      <div className="soh">
        <div className="so-av">{nombreCargado ? iniciales(nombreMostrado) : ''}</div>
        <div className="so-hi">
          <div className="so-name">{nombreCargado ?? ''}</div>
          <div className="so-meta">
            <span>{metaHeader(turnoFechaHora)}</span>
            {especialidad && (
              <>
                <span className="dot" />
                <span>{especialidad}</span>
              </>
            )}
          </div>
        </div>
        <button type="button" aria-label="Cerrar" onClick={onClose}>
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className="sob">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
        )}

        {tieneVoz && (
          <div className="mode">
            <button type="button" className={modo === 'texto' ? 'on' : ''} onClick={() => setModo('texto')} disabled={transcribiendo}>
              <svg viewBox="0 0 24 24"><path d="M4 7h10M4 12h16M4 17h7" /></svg>
              Escribir
            </button>
            <button type="button" className={modo === 'voz' ? 'on' : ''} onClick={() => setModo('voz')} disabled={transcribiendo}>
              <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
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

        <div className="ns-card">
          <label className="fl" htmlFor="ns-fecha">Fecha</label>
          <input className="date" type="date" id="ns-fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        {tieneModulo(especialidad) && (
          <ModuloEspecialidad
            especialidad={especialidad}
            pacienteId={pacienteId}
            valores={datosModulo}
            onChange={cambiarValorModulo}
            edadPaciente={edadPaciente}
            sexoPaciente={sexoPaciente}
          />
        )}

        <div className="ns-card nota">
          <span className="fl">Nota de {t.sesion}</span>
          {modo === 'voz' ? (
            <VoiceRecorder
              variant="nota"
              onTranscription={handleTranscripcion}
              onError={(msg) => setError(msg)}
              onTranscribingChange={setTranscribiendo}
              maxSeconds={maxSeconds}
            />
          ) : (
            <>
              {notaDeVoz && (
                <span className="ns-trn">
                  <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                  Transcripto por voz<span>· {`${String(Math.floor(notaDeVoz.duracion / 60)).padStart(2, '0')}:${String(notaDeVoz.duracion % 60).padStart(2, '0')}`}</span>
                </span>
              )}
              <RichTextEditor
                variant="nota"
                value={contenido}
                onChange={handleContenidoChange}
                placeholder={notaPlaceholder(especialidad)}
                minHeight="160px"
              />
            </>
          )}
        </div>
      </div>

      <div className="sof">
        <span className="autosave" aria-live={autosaveEstado === 'saving' ? 'polite' : undefined}>
          {autosaveEstado === 'saving' ? (
            <>
              <span className="s" />
              Guardando…
            </>
          ) : autosaveEstado === 'saved' ? (
            <>
              <span className="d ok" />
              <span className="lg">Borrador guardado</span>
              <span className="sh">Guardado</span>
              {horaGuardado && (
                <>
                  {' · '}
                  <time>{new Date(horaGuardado).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}</time>
                </>
              )}
            </>
          ) : (
            <>
              <span className="d no" />
              Sin guardar aún
            </>
          )}
        </span>
        <button
          type="button"
          className="ns-btn-primary"
          onClick={handleGuardar}
          disabled={loading || (isHtmlEmpty(contenido) && !hayDatosModulo(datosModulo))}
          title={isHtmlEmpty(contenido) && !hayDatosModulo(datosModulo) ? 'Escribí o dictá la nota para guardar' : undefined}
        >
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
          {loading ? 'Guardando...' : 'Guardar nota'}
        </button>
      </div>
    </div>
  )
}
