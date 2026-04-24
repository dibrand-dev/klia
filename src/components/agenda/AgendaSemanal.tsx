'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, addDays, subDays,
  format, isSameDay, isToday, parseISO, isBefore, isAfter,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import {
  cn, ESTADO_TURNO_COLORS, ESTADO_TURNO_DOT,
  formatNombreCompleto,
} from '@/lib/utils'
import type { Turno, Paciente } from '@/types/database'
import NuevoTurnoModal from './NuevoTurnoModal'
import TurnoDetalleModal from './TurnoDetalleModal'

const HORA_INICIO = 7
const HORA_FIN = 21
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i)

interface AgendaSemanalProps {
  turnosIniciales: Turno[]
  pacientes: Paciente[]
  terapeutaId: string
}

function getTopOffset(fechaHora: string) {
  const d = parseISO(fechaHora)
  return ((d.getHours() - HORA_INICIO) * 60 + d.getMinutes()) * (64 / 60)
}

function getHeight(min: number) {
  return min * (64 / 60)
}

export default function AgendaSemanal({ turnosIniciales, pacientes, terapeutaId }: AgendaSemanalProps) {
  const router = useRouter()
  const [semanaActual, setSemanaActual] = useState(new Date())
  const [diaActual, setDiaActual] = useState(new Date())
  const [turnos, setTurnos] = useState<Turno[]>(turnosIniciales)
  const [modalNuevo, setModalNuevo] = useState<{ fecha: Date } | null>(null)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno | null>(null)

  // Mobile: navega a la página de nuevo turno con la fecha/hora preseleccionada
  function abrirNuevoTurnoMobile(fecha: Date) {
    const fechaStr = format(fecha, 'yyyy-MM-dd')
    const horaStr = format(fecha, 'HH:mm')
    router.push(`/turnos/nuevo?fecha=${fechaStr}&hora=${horaStr}`)
  }

  const inicioSemana = startOfWeek(semanaActual, { weekStartsOn: 1 })
  const finSemana = endOfWeek(semanaActual, { weekStartsOn: 1 })
  const dias = eachDayOfInterval({ start: inicioSemana, end: finSemana })

  const fetchSemana = useCallback(async (refDate: Date) => {
    const inicio = startOfWeek(refDate, { weekStartsOn: 1 })
    const fin = endOfWeek(refDate, { weekStartsOn: 1 })
    const supabase = createClient()
    const { data } = await supabase
      .from('turnos')
      .select('*, paciente:pacientes(*)')
      .eq('terapeuta_id', terapeutaId)
      .gte('fecha_hora', inicio.toISOString())
      .lte('fecha_hora', fin.toISOString())
      .order('fecha_hora')
    if (data) setTurnos(data as unknown as Turno[])
  }, [terapeutaId])

  function navegarDia(dir: 1 | -1) {
    const nuevo = dir === 1 ? addDays(diaActual, 1) : subDays(diaActual, 1)
    setDiaActual(nuevo)
    const nuevoInicio = startOfWeek(nuevo, { weekStartsOn: 1 })
    if (!isSameDay(nuevoInicio, inicioSemana)) {
      setSemanaActual(nuevo)
      fetchSemana(nuevo)
    }
  }

  function navegarSemana(dir: 1 | -1) {
    const nueva = dir === 1 ? addWeeks(semanaActual, 1) : subWeeks(semanaActual, 1)
    setSemanaActual(nueva)
    fetchSemana(nueva)
  }

  function irAHoy() {
    const hoy = new Date()
    setSemanaActual(hoy)
    setDiaActual(hoy)
    fetchSemana(hoy)
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
  const turnosDia = getTurnosDelDia(diaActual)

  // ─── Columna de turnos reutilizable ──────────────────────────
  function ColumnaHoras({ dia, onCeldaClick }: { dia: Date; onCeldaClick: (f: Date) => void }) {
    const lista = getTurnosDelDia(dia)
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
        {lista.map((turno) => {
          const top = getTopOffset(turno.fecha_hora)
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

  return (
    <div className="flex flex-col h-full">

      {/* ══════════════ MOBILE: Vista día ══════════════ */}
      <div className="flex flex-col h-full md:hidden">

        {/* Header mobile */}
        <div className="bg-white border-b border-gray-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-10">
          <button onClick={() => navegarDia(-1)} className="p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button onClick={irAHoy} className="flex-1 text-center">
            <p className="text-xs text-gray-500 capitalize font-medium">
              {format(diaActual, 'EEEE', { locale: es })}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-base font-bold text-gray-900 capitalize">
                {format(diaActual, "d 'de' MMMM", { locale: es })}
              </p>
              {isToday(diaActual) && (
                <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full leading-none">
                  Hoy
                </span>
              )}
            </div>
          </button>

          <button onClick={() => navegarDia(1)} className="p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => abrirNuevoTurnoMobile(diaActual)}
            className="btn-primary flex items-center gap-1 px-3 py-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo
          </button>
        </div>

        {/* Stats mobile */}
        <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex gap-4 text-xs overflow-x-auto">
          <span className="text-gray-500 whitespace-nowrap">
            <strong className="text-gray-800">{turnosDia.length}</strong> turno{turnosDia.length !== 1 ? 's' : ''}
          </span>
          {turnosDia.filter(t => t.estado === 'realizado').length > 0 && (
            <span className="text-gray-500 whitespace-nowrap">
              <strong className="text-green-600">{turnosDia.filter(t => t.estado === 'realizado').length}</strong> realizado{turnosDia.filter(t => t.estado === 'realizado').length !== 1 ? 's' : ''}
            </span>
          )}
          {turnosDia.filter(t => ['pendiente', 'confirmado'].includes(t.estado)).length > 0 && (
            <span className="text-gray-500 whitespace-nowrap">
              <strong className="text-yellow-600">
                {turnosDia.filter(t => ['pendiente', 'confirmado'].includes(t.estado)).length}
              </strong> pendiente{turnosDia.filter(t => ['pendiente', 'confirmado'].includes(t.estado)).length !== 1 ? 's' : ''}
            </span>
          )}
          {turnosDia.length === 0 && (
            <span className="text-gray-400">Sin turnos este día</span>
          )}
        </div>

        {/* Grilla día mobile */}
        <div className="flex-1 overflow-auto">
          <div className="flex">
            <div className="w-12 flex-shrink-0 bg-white border-r border-gray-200 sticky left-0">
              {HORAS.map((hora) => (
                <div key={hora} className="h-16 border-b border-gray-100 flex items-start justify-end pr-1.5 pt-1">
                  <span className="text-[11px] text-gray-400">{hora}:00</span>
                </div>
              ))}
            </div>
            <ColumnaHoras dia={diaActual} onCeldaClick={abrirNuevoTurnoMobile} />
          </div>
        </div>
      </div>

      {/* ══════════════ DESKTOP: Vista semana ══════════════ */}
      <div className="hidden md:flex md:flex-col h-full">

        {/* Header desktop */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">Agenda</h1>
            <span className="text-sm text-gray-500 capitalize">
              {format(inicioSemana, "d 'de' MMMM", { locale: es })}
              {' — '}
              {format(finSemana, "d 'de' MMMM yyyy", { locale: es })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => navegarSemana(-1)} className="px-3 py-2 hover:bg-gray-50 text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={irAHoy} className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border-x border-gray-200">
                Hoy
              </button>
              <button onClick={() => navegarSemana(1)} className="px-3 py-2 hover:bg-gray-50 text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button onClick={() => setModalNuevo({ fecha: new Date() })} className="btn-primary flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo turno
            </button>
          </div>
        </div>

        {/* Stats desktop */}
        <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-6 text-xs text-gray-500">
          <span><strong className="text-gray-700">{turnosSemana.length}</strong> turnos esta semana</span>
          <span><strong className="text-green-600">{turnosSemana.filter(t => t.estado === 'realizado').length}</strong> realizados</span>
          <span><strong className="text-yellow-600">{turnosSemana.filter(t => ['pendiente', 'confirmado'].includes(t.estado)).length}</strong> pendientes</span>
          <span><strong className="text-red-500">{turnosSemana.filter(t => ['cancelado', 'no_asistio'].includes(t.estado)).length}</strong> cancelados/ausentes</span>
        </div>

        {/* Grilla semana desktop */}
        <div className="flex-1 overflow-auto">
          <div className="flex min-w-[800px]">
            <div className="w-16 flex-shrink-0 bg-white border-r border-gray-200 sticky left-0 z-10">
              <div className="h-14 border-b border-gray-200" />
              {HORAS.map((hora) => (
                <div key={hora} className="h-16 border-b border-gray-100 flex items-start justify-end pr-2 pt-1">
                  <span className="text-xs text-gray-400 font-medium">{hora}:00</span>
                </div>
              ))}
            </div>

            {dias.map((dia) => {
              const esHoy = isToday(dia)
              return (
                <div key={dia.toISOString()} className="flex-1 min-w-0 border-r border-gray-200 last:border-r-0">
                  <div className={cn(
                    'h-14 border-b border-gray-200 flex flex-col items-center justify-center sticky top-0 z-10 bg-white',
                    esHoy && 'bg-primary-fixed/20'
                  )}>
                    <span className={cn('text-xs font-medium uppercase tracking-wider', esHoy ? 'text-primary' : 'text-gray-500')}>
                      {format(dia, 'EEE', { locale: es })}
                    </span>
                    <span className={cn(
                      'text-lg font-semibold mt-0.5',
                      esHoy ? 'w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm' : 'text-gray-900'
                    )}>
                      {format(dia, 'd')}
                    </span>
                  </div>
                  <ColumnaHoras dia={dia} onCeldaClick={(f) => setModalNuevo({ fecha: f })} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══ Modales compartidos ══ */}
      {modalNuevo && (
        <NuevoTurnoModal
          fechaInicial={modalNuevo.fecha}
          pacientes={pacientes}
          terapeutaId={terapeutaId}
          onClose={() => setModalNuevo(null)}
          onCreado={(t) => { setTurnos((prev) => [...prev, t]); setModalNuevo(null) }}
        />
      )}

      {turnoSeleccionado && (
        <TurnoDetalleModal
          turno={turnoSeleccionado}
          onClose={() => setTurnoSeleccionado(null)}
          onTurnoActualizado={actualizarTurno}
          onEliminar={async (id) => {
            const supabase = createClient()
            await supabase.from('turnos').delete().eq('id', id)
            setTurnos((prev) => prev.filter((t) => t.id !== id))
            setTurnoSeleccionado(null)
          }}
        />
      )}
    </div>
  )
}
