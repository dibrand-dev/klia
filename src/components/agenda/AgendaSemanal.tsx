'use client'

import { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, addMonths, subMonths,
  startOfMonth, endOfMonth,
  format, isSameDay, isToday, parseISO, isBefore, isAfter,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import {
  cn, ESTADO_TURNO_COLORS, ESTADO_TURNO_DOT,
  formatNombreCompleto,
} from '@/lib/utils'
import type { Turno, Paciente, Entrevista } from '@/types/database'
import SlideOver from '@/components/ui/SlideOver'
import NuevoTurnoPageForm from './NuevoTurnoPageForm'
import TurnoDetalleModal from './TurnoDetalleModal'
import EntrevistaDetalleModal from './EntrevistaDetalleModal'
import VistaDia from './VistaDia'
import VistaMes from './VistaMes'

const DEFAULT_HORA_INICIO = 7
const DEFAULT_HORA_FIN = 21

type GoogleEventSerialized = {
  id: string
  titulo: string
  inicio: string
  fin: string
}

type GoogleDayEventSerialized = {
  id: string
  titulo: string
  fecha: string
}

interface AgendaSemanalProps {
  turnosIniciales: Turno[]
  pacientes: Paciente[]
  terapeutaId: string
  googleConnected?: boolean
  googleEventsIniciales?: GoogleEventSerialized[]
  googleEventsDiaCompletosIniciales?: GoogleDayEventSerialized[]
  entrevistasIniciales?: Entrevista[]
  horaInicio?: number
  horaFin?: number
}

function getTopOffset(fechaHora: string, horaInicio: number) {
  const d = parseISO(fechaHora)
  return ((d.getHours() - horaInicio) * 60 + d.getMinutes()) * (64 / 60)
}

function getHeight(min: number) {
  return min * (64 / 60)
}

export default function AgendaSemanal({
  turnosIniciales, pacientes, terapeutaId, googleConnected = false, googleEventsIniciales = [], googleEventsDiaCompletosIniciales = [], entrevistasIniciales = [],
  horaInicio: horaInicioP, horaFin: horaFinP,
}: AgendaSemanalProps) {
  const hi = horaInicioP ?? DEFAULT_HORA_INICIO
  const hf = horaFinP ?? DEFAULT_HORA_FIN
  const HORAS = Array.from({ length: hf - hi }, (_, i) => hi + i)
  const [vista, setVista] = useState<'dia' | 'semana' | 'mes'>('semana')
  const [semanaActual, setSemanaActual] = useState(new Date())
  const [diaActual, setDiaActual] = useState(new Date())
  const [mesActual, setMesActual] = useState(new Date())
  const [turnos, setTurnos] = useState<Turno[]>(turnosIniciales)
  const [googleEvents, setGoogleEvents] = useState<GoogleEventSerialized[]>(googleEventsIniciales)
  const [googleEventsDiaCompleto, setGoogleEventsDiaCompleto] = useState<GoogleDayEventSerialized[]>(googleEventsDiaCompletosIniciales)
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>(entrevistasIniciales)
  const [nuevoFecha, setNuevoFecha] = useState<Date>(new Date())
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno | null>(null)
  const [entrevistaSeleccionada, setEntrevistaSeleccionada] = useState<Entrevista | null>(null)
  function abrirNuevoTurno(fecha: Date) {
    setNuevoFecha(fecha)
    setNuevoOpen(true)
  }

  const inicioSemana = startOfWeek(semanaActual, { weekStartsOn: 1 })
  const finSemana = endOfWeek(semanaActual, { weekStartsOn: 1 })
  const dias = eachDayOfInterval({ start: inicioSemana, end: finSemana })

  useEffect(() => {
    if (window.innerWidth < 768) setVista('dia')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const googleCacheRef = useRef<{ desde: Date; hasta: Date } | null>(null)

  useEffect(() => {
    if (googleConnected) {
      const desde = new Date()
      desde.setMonth(desde.getMonth() - 3)
      desde.setHours(0, 0, 0, 0)
      const hasta = new Date()
      hasta.setMonth(hasta.getMonth() + 3)
      hasta.setHours(23, 59, 59, 999)
      googleCacheRef.current = { desde, hasta }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSemana = useCallback(async (refDate: Date) => {
    const inicio = startOfWeek(refDate, { weekStartsOn: 1 })
    const fin = endOfWeek(refDate, { weekStartsOn: 1 })
    const inicioStr = format(inicio, 'yyyy-MM-dd')
    const finStr = format(fin, 'yyyy-MM-dd')
    const supabase = createClient()
    const turnosPromise = supabase
      .from('turnos')
      .select('*, paciente:pacientes(*)')
      .eq('terapeuta_id', terapeutaId)
      .gte('fecha_hora', inicio.toISOString())
      .lte('fecha_hora', fin.toISOString())
      .order('fecha_hora')
    const entrevistasPromise = supabase
      .from('entrevistas')
      .select('*')
      .eq('terapeuta_id', terapeutaId)
      .gte('fecha', inicioStr)
      .lte('fecha', finStr)
      .neq('estado', 'cancelada')

    // Solo llama a la API de Google si la semana está fuera del caché cargado al inicio
    const dentroDelCache = googleCacheRef.current
      ? inicio >= googleCacheRef.current.desde && fin <= googleCacheRef.current.hasta
      : false
    const googlePromise = googleConnected && !dentroDelCache
      ? fetch(`/api/google-calendar/events?start=${inicio.toISOString()}&end=${fin.toISOString()}`)
          .then((r) => r.json() as Promise<{ eventosConHora: GoogleEventSerialized[]; eventosDiaCompleto: GoogleDayEventSerialized[] }>)
          .catch(() => ({ eventosConHora: [] as GoogleEventSerialized[], eventosDiaCompleto: [] as GoogleDayEventSerialized[] }))
      : Promise.resolve(null)

    const [{ data }, { data: entrevistasData }, gDataNueva] = await Promise.all([turnosPromise, entrevistasPromise, googlePromise])
    if (data) setTurnos(data as unknown as Turno[])
    if (entrevistasData) setEntrevistas(entrevistasData as Entrevista[])
    if (gDataNueva) {
      setGoogleEvents((prev) => {
        const ids = new Set(prev.map((e) => e.id))
        return [...prev, ...gDataNueva.eventosConHora.filter((e) => !ids.has(e.id))]
      })
      setGoogleEventsDiaCompleto((prev) => {
        const ids = new Set(prev.map((e) => e.id))
        return [...prev, ...gDataNueva.eventosDiaCompleto.filter((e) => !ids.has(e.id))]
      })
    }
  }, [terapeutaId, googleConnected])

  const fetchMes = useCallback(async (refDate: Date) => {
    const inicioMes = startOfMonth(refDate)
    const finMes = endOfMonth(refDate)
    const inicioGrid = startOfWeek(inicioMes, { weekStartsOn: 1 })
    const finGrid = endOfWeek(finMes, { weekStartsOn: 1 })
    const inicioStr = format(inicioGrid, 'yyyy-MM-dd')
    const finStr = format(finGrid, 'yyyy-MM-dd')
    const supabase = createClient()
    const [{ data }, { data: entrevistasData }] = await Promise.all([
      supabase
        .from('turnos')
        .select('*, paciente:pacientes(*)')
        .eq('terapeuta_id', terapeutaId)
        .gte('fecha_hora', inicioGrid.toISOString())
        .lte('fecha_hora', finGrid.toISOString())
        .order('fecha_hora'),
      supabase
        .from('entrevistas')
        .select('*')
        .eq('terapeuta_id', terapeutaId)
        .gte('fecha', inicioStr)
        .lte('fecha', finStr)
        .neq('estado', 'cancelada'),
    ])
    if (data) {
      setTurnos((prev) => {
        const ids = new Set((data as unknown as Turno[]).map((t) => t.id))
        return [...prev.filter((t) => !ids.has(t.id)), ...(data as unknown as Turno[])]
      })
    }
    if (entrevistasData) {
      setEntrevistas((prev) => {
        const ids = new Set((entrevistasData as Entrevista[]).map((e) => e.id))
        return [...prev.filter((e) => !ids.has(e.id)), ...(entrevistasData as Entrevista[])]
      })
    }
  }, [terapeutaId])

  function navegarSemana(dir: 1 | -1) {
    const nueva = dir === 1 ? addWeeks(semanaActual, 1) : subWeeks(semanaActual, 1)
    setSemanaActual(nueva)
    fetchSemana(nueva)
  }

  function navegarMes(dir: 1 | -1) {
    const nuevo = dir === 1 ? addMonths(mesActual, 1) : subMonths(mesActual, 1)
    setMesActual(nuevo)
    fetchMes(nuevo)
  }

  function handleDiaChange(d: Date) {
    const prevInicio = startOfWeek(diaActual, { weekStartsOn: 1 })
    const newInicio = startOfWeek(d, { weekStartsOn: 1 })
    setDiaActual(d)
    if (!isSameDay(prevInicio, newInicio)) {
      setSemanaActual(d)
      fetchSemana(d)
    }
  }

  function handleVista(v: 'dia' | 'semana' | 'mes') {
    setVista(v)
    if (v === 'mes') fetchMes(mesActual)
    else if (v === 'semana') fetchSemana(semanaActual)
  }

  function irAHoy() {
    const hoy = new Date()
    setSemanaActual(hoy)
    setDiaActual(hoy)
    setMesActual(hoy)
    if (vista === 'mes') fetchMes(hoy)
    else fetchSemana(hoy)
  }

  function getTurnosDelDia(dia: Date) {
    return turnos
      .filter((t) => isSameDay(parseISO(t.fecha_hora), dia))
      .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
  }

  function actualizarTurno(turnoActualizado: Turno) {
    setTurnos((prev) => prev.map((t) => t.id === turnoActualizado.id ? turnoActualizado : t))
    setTurnoSeleccionado(turnoActualizado)
  }

  const turnosSemana = turnos.filter((t) => {
    const f = parseISO(t.fecha_hora)
    return !isBefore(f, inicioSemana) && !isAfter(f, finSemana)
  })

  const showAllDayRow = googleEventsDiaCompleto.some((e) =>
    dias.some((dia) => isSameDay(parseISO(e.fecha + 'T12:00:00'), dia))
  )

  // ─── Columna de turnos reutilizable ──────────────────────────
  function ColumnaHoras({ dia, onCeldaClick }: { dia: Date; onCeldaClick: (f: Date) => void }) {
    const lista = getTurnosDelDia(dia)
    const gEventsDia = googleEvents.filter((e) => {
      if (!isSameDay(new Date(e.inicio), dia)) return false
      const inicio = new Date(e.inicio)
      const fin = new Date(e.fin)
      const inicioH = inicio.getHours() + inicio.getMinutes() / 60
      const finH = fin.getHours() + fin.getMinutes() / 60
      return inicioH < hf && finH > hi
    })
    const entrevistasDia = entrevistas.filter(
      (e) => isSameDay(parseISO(e.fecha + 'T12:00:00'), dia) && e.estado !== 'cancelada'
    )
    return (
      <div className="flex-1 relative">
        {HORAS.map((hora) => (
          <div
            key={hora}
            className="h-16 border-b border-gray-100 hover:bg-primary-fixed/20 cursor-pointer transition-colors"
            onClick={() => {
              const f = new Date(dia)
              f.setHours(hora, 0, 0, 0)
              onCeldaClick(f)
            }}
          />
        ))}
        {/* Eventos de Google Calendar */}
        {gEventsDia.map((ev) => {
          const inicio = new Date(ev.inicio)
          const fin = new Date(ev.fin)
          const inicioH = Math.max(inicio.getHours() + inicio.getMinutes() / 60, hi)
          const finH = Math.min(fin.getHours() + fin.getMinutes() / 60, hf)
          const top = (inicioH - hi) * 64
          const height = Math.max((finH - inicioH) * 64, 20)
          return (
            <div
              key={ev.id}
              className="absolute left-0.5 right-0.5 rounded-md px-2 py-1 text-xs overflow-hidden pointer-events-none border border-dashed border-gray-400 bg-gray-100/80"
              style={{ top: `${top}px`, height: `${height}px` }}
              title={`Google Calendar: ${ev.titulo}`}
            >
              <span className="text-gray-500 truncate block font-medium">{ev.titulo}</span>
            </div>
          )
        })}
        {/* Entrevistas */}
        {entrevistasDia.map((entrevista) => {
          const fechaHora = `${entrevista.fecha}T${entrevista.hora.slice(0, 5)}:00`
          const top = getTopOffset(fechaHora, hi)
          const height = Math.max(getHeight(entrevista.duracion), 28)
          return (
            <div
              key={entrevista.id}
              className="absolute left-0.5 right-0.5 rounded-md px-2 py-1 cursor-pointer border text-xs bg-amber-100 border-amber-400 text-amber-900 hover:shadow-md transition-shadow overflow-hidden"
              style={{ top: `${top}px`, height: `${height}px` }}
              onClick={(e) => { e.stopPropagation(); setEntrevistaSeleccionada(entrevista) }}
            >
              <div className="flex items-center gap-1 font-semibold truncate">
                <span className="w-4 h-4 rounded-full bg-amber-400 text-amber-900 text-[9px] font-bold flex items-center justify-center flex-shrink-0">E</span>
                <span className="truncate flex-1">{entrevista.apellido}, {entrevista.nombre}</span>
              </div>
              {height > 40 && (
                <div className="opacity-80 truncate mt-0.5">
                  {entrevista.hora.slice(0, 5)} · {entrevista.duracion} min
                </div>
              )}
            </div>
          )
        })}
        {lista.map((turno) => {
          const top = getTopOffset(turno.fecha_hora, hi)
          const height = Math.max(getHeight(turno.duracion_min), 28)
          const p = turno.paciente
          return (
            <div
              key={turno.id}
              className={cn(
                'absolute left-0.5 right-0.5 rounded-md px-2 py-1 cursor-pointer border text-xs',
                'hover:shadow-md transition-shadow overflow-hidden',
                ESTADO_TURNO_COLORS[turno.estado]
              )}
              style={{ top: `${top}px`, height: `${height}px` }}
              onClick={(e) => { e.stopPropagation(); setTurnoSeleccionado(turno) }}
            >
              <div className="flex items-center gap-1 font-semibold truncate">
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', ESTADO_TURNO_DOT[turno.estado])} />
                <span className="truncate flex-1">
                  {p ? formatNombreCompleto(p.nombre, p.apellido) : 'Paciente'}
                </span>
                {turno.serie_recurrente_id && (
                  <span className="flex-shrink-0 text-[10px] opacity-60 leading-none" title="Turno fijo — serie recurrente">↻</span>
                )}
                {turno.pagado && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="Pagado" />
                )}
              </div>
              {height > 40 && (
                <div className="opacity-80 truncate mt-0.5">
                  {format(parseISO(turno.fecha_hora), 'HH:mm')} · {turno.duracion_min} min
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function ViewSelector() {
    return (
      <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs">
        {(['dia', 'semana', 'mes'] as const).map((v) => (
          <button
            key={v}
            onClick={() => handleVista(v)}
            className={cn(
              'px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors',
              vista === v ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ══ Vista Día ══ */}
      {vista === 'dia' && (
        <VistaDia
          dia={diaActual}
          turnos={turnos}
          entrevistas={entrevistas}
          googleEvents={googleEvents}
          onDiaChange={handleDiaChange}
          onNuevoTurno={abrirNuevoTurno}
          onTurnoClick={setTurnoSeleccionado}
          onEntrevistaClick={setEntrevistaSeleccionada}
          vistaSelector={<ViewSelector />}
          horaInicio={hi}
          horaFin={hf}
        />
      )}

      {/* ══ Vista Semana ══ */}
      {vista === 'semana' && (
        <div className="flex flex-col h-full">
          <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2 md:gap-4">
              <span className="text-lg md:text-xl font-semibold text-gray-900 capitalize">
                {format(inicioSemana, "d 'de' MMMM", { locale: es })}
                {' — '}
                {format(finSemana, "d 'de' MMMM yyyy", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => navegarSemana(-1)} className="px-2 md:px-3 py-2 hover:bg-gray-50 text-gray-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button onClick={irAHoy} className="px-2 md:px-3 py-2 text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50 border-x border-gray-200">
                  Hoy
                </button>
                <button onClick={() => navegarSemana(1)} className="px-2 md:px-3 py-2 hover:bg-gray-50 text-gray-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <button onClick={() => abrirNuevoTurno(new Date())} className="btn-primary flex items-center gap-1 md:gap-2 px-3 py-2 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Nuevo turno</span>
              </button>
            </div>
          </div>

          <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-2 flex items-center justify-between gap-4 text-xs text-gray-500">
            <ViewSelector />
            <div className="flex items-center gap-4 md:gap-6 overflow-x-auto">
              <span><strong className="text-gray-700">{turnosSemana.length}</strong> turnos esta semana</span>
              <span><strong className="text-green-600">{turnosSemana.filter(t => t.estado === 'realizado').length}</strong> realizados</span>
              <span><strong className="text-yellow-600">{turnosSemana.filter(t => ['pendiente', 'confirmado'].includes(t.estado)).length}</strong> pendientes</span>
              <span className="hidden md:inline"><strong className="text-red-500">{turnosSemana.filter(t => ['cancelado', 'no_asistio'].includes(t.estado)).length}</strong> cancelados/ausentes</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="flex min-w-[600px]">
              <div className="w-12 md:w-16 flex-shrink-0 bg-white border-r border-gray-200 sticky left-0 z-10">
                <div className="h-14 border-b border-gray-200" />
                {showAllDayRow && <div className="h-8 border-b border-gray-100" />}
                {HORAS.map((hora) => (
                  <div key={hora} className="h-16 border-b border-gray-100 flex items-start justify-end pr-1.5 md:pr-2 pt-1">
                    <span className="text-[11px] md:text-xs text-gray-400 font-medium">{hora}:00</span>
                  </div>
                ))}
              </div>
              {dias.map((dia) => {
                const esHoy = isToday(dia)
                const dayAllDayEvents = showAllDayRow
                  ? googleEventsDiaCompleto.filter((e) => isSameDay(parseISO(e.fecha + 'T12:00:00'), dia))
                  : []
                return (
                  <div key={dia.toISOString()} className="flex-1 min-w-0 border-r border-gray-200 last:border-r-0">
                    <div className={cn(
                      'h-14 border-b border-gray-200 flex flex-col items-center justify-center sticky top-0 z-10 bg-white',
                      esHoy && 'bg-primary-fixed/20'
                    )}>
                      <span className={cn('text-[10px] md:text-xs font-medium uppercase tracking-wider', esHoy ? 'text-primary' : 'text-gray-500')}>
                        {format(dia, 'EEE', { locale: es })}
                      </span>
                      <span className={cn(
                        'text-base md:text-lg font-semibold mt-0.5',
                        esHoy ? 'w-7 h-7 md:w-8 md:h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm' : 'text-gray-900'
                      )}>
                        {format(dia, 'd')}
                      </span>
                    </div>
                    {showAllDayRow && (
                      <div className="h-8 border-b border-gray-100 flex items-center gap-1 px-1 overflow-hidden">
                        {dayAllDayEvents.slice(0, 2).map((ev) => (
                          <span key={ev.id} className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5 truncate">
                            {ev.titulo}
                          </span>
                        ))}
                        {dayAllDayEvents.length > 2 && (
                          <span className="text-xs text-gray-400 flex-shrink-0">+{dayAllDayEvents.length - 2}</span>
                        )}
                      </div>
                    )}
                    <ColumnaHoras dia={dia} onCeldaClick={abrirNuevoTurno} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ Vista Mes ══ */}
      {vista === 'mes' && (
        <VistaMes
          mes={mesActual}
          turnos={turnos}
          entrevistas={entrevistas}
          googleEvents={googleEvents}
          onMesChange={(m) => { setMesActual(m); fetchMes(m) }}
          onDiaClick={(d) => { setDiaActual(d); setVista('dia') }}
          onNuevoTurno={abrirNuevoTurno}
          vistaSelector={<ViewSelector />}
        />
      )}

      {/* ══ Slide-overs compartidos ══ */}
      <SlideOver
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        title="Nuevo turno"
      >
        <Suspense fallback={null}>
          <NuevoTurnoPageForm
            key={nuevoFecha.toISOString()}
            pacientes={pacientes}
            terapeutaId={terapeutaId}
            fechaInicial={nuevoFecha}
            onCreado={(t) => { setTurnos((prev) => [...prev, t]); setNuevoOpen(false) }}
            onEntrevistaCreada={(e) => { setEntrevistas((prev) => [...prev, e]); setNuevoOpen(false) }}
            onClose={() => setNuevoOpen(false)}
          />
        </Suspense>
      </SlideOver>

      {entrevistaSeleccionada && (
        <EntrevistaDetalleModal
          entrevista={entrevistaSeleccionada}
          onClose={() => setEntrevistaSeleccionada(null)}
          onEntrevistaActualizada={(updated) => {
            setEntrevistas((prev) => prev.map((e) => e.id === updated.id ? updated : e))
            setEntrevistaSeleccionada(updated.estado === 'cancelada' ? null : updated)
          }}
          onEliminar={async (id) => {
            fetch('/api/google-calendar/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ entrevista_id: id, action: 'delete' }),
            }).catch(() => {})
            const supabase = createClient()
            await supabase.from('entrevistas').delete().eq('id', id)
            setEntrevistas((prev) => prev.filter((e) => e.id !== id))
            setEntrevistaSeleccionada(null)
          }}
        />
      )}

      {turnoSeleccionado && (
        <TurnoDetalleModal
          turno={turnoSeleccionado}
          onClose={() => setTurnoSeleccionado(null)}
          onTurnoActualizado={actualizarTurno}
          onEliminar={async (id) => {
            fetch('/api/google-calendar/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ turno_id: id, action: 'delete' }),
            }).catch(() => {})
            const supabase = createClient()
            await supabase.from('turnos').delete().eq('id', id)
            setTurnos((prev) => prev.filter((t) => t.id !== id))
            setTurnoSeleccionado(null)
          }}
          onEliminarFuturos={async (turnoId, serieId, fechaHora) => {
            fetch('/api/google-calendar/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ serie_id: serieId, desde_fecha: fechaHora, action: 'delete' }),
            }).catch(() => {})
            const supabase = createClient()
            await supabase
              .from('turnos')
              .delete()
              .eq('serie_recurrente_id', serieId)
              .gte('fecha_hora', fechaHora)
              .in('estado', ['pendiente', 'confirmado'])
            const { data: rest } = await supabase
              .from('turnos')
              .select('id')
              .eq('serie_recurrente_id', serieId)
              .gte('fecha_hora', new Date().toISOString())
              .limit(1)
            if (!rest || rest.length === 0) {
              await supabase.from('turnos_recurrentes').update({ activo: false }).eq('id', serieId)
            }
            setTurnos((prev) => prev.filter((t) => {
              if (t.serie_recurrente_id !== serieId) return true
              if (new Date(t.fecha_hora) < new Date(fechaHora)) return true
              return !['pendiente', 'confirmado'].includes(t.estado)
            }))
            setTurnoSeleccionado(null)
          }}
        />
      )}
    </div>
  )
}
