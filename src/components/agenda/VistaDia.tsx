'use client'

import { addDays, subDays, format, isToday, isSameDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Turno, Entrevista } from '@/types/database'
import { cn, ESTADO_TURNO_COLORS, ESTADO_TURNO_DOT, formatNombreCompleto } from '@/lib/utils'

type GoogleEventSerialized = { id: string; titulo: string; inicio: string; fin: string }

function getTopOffset(hora: string, fecha: string, horaInicio: number) {
  const d = parseISO(`${fecha}T${hora.slice(0, 5)}:00`)
  return ((d.getHours() - horaInicio) * 60 + d.getMinutes()) * (64 / 60)
}

function getTopOffsetISO(fechaHora: string, horaInicio: number) {
  const d = parseISO(fechaHora)
  return ((d.getHours() - horaInicio) * 60 + d.getMinutes()) * (64 / 60)
}

function getHeight(min: number) {
  return min * (64 / 60)
}

interface VistaDiaProps {
  dia: Date
  turnos: Turno[]
  entrevistas: Entrevista[]
  googleEvents: GoogleEventSerialized[]
  onDiaChange: (dia: Date) => void
  onNuevoTurno: (fecha: Date) => void
  onTurnoClick: (turno: Turno) => void
  onEntrevistaClick: (entrevista: Entrevista) => void
  vistaSelector: React.ReactNode
  horaInicio?: number
  horaFin?: number
}

export default function VistaDia({
  dia, turnos, entrevistas, googleEvents,
  onDiaChange, onNuevoTurno, onTurnoClick, onEntrevistaClick, vistaSelector,
  horaInicio: horaInicioP, horaFin: horaFinP,
}: VistaDiaProps) {
  const hi = horaInicioP ?? 7
  const hf = horaFinP ?? 21
  const HORAS = Array.from({ length: hf - hi }, (_, i) => hi + i)
  const turnosDia = turnos
    .filter((t) => isSameDay(parseISO(t.fecha_hora), dia))
    .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
  const entrevistasDia = entrevistas.filter(
    (e) => isSameDay(parseISO(e.fecha + 'T12:00:00'), dia) && e.estado !== 'cancelada'
  )
  const gEventsDia = googleEvents.filter((e) => {
    if (!isSameDay(new Date(e.inicio), dia)) return false
    const inicio = new Date(e.inicio)
    const fin = new Date(e.fin)
    const inicioH = inicio.getHours() + inicio.getMinutes() / 60
    const finH = fin.getHours() + fin.getMinutes() / 60
    return inicioH < hf && finH > hi
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-gray-900 capitalize truncate">
            <span className="hidden sm:inline text-xl">
              {format(dia, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </span>
            <span className="sm:hidden text-base">
              {format(dia, "EEE d 'de' MMM", { locale: es })}
              {isToday(dia) && <span className="ml-1.5 text-xs text-primary font-medium">Hoy</span>}
            </span>
          </p>
          {isToday(dia) && (
            <span className="text-xs text-primary font-medium hidden sm:inline">Hoy</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => onDiaChange(subDays(dia, 1))} className="px-2 md:px-3 py-2 hover:bg-gray-50 text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={() => onDiaChange(new Date())} className="px-2 md:px-3 py-2 text-xs md:text-sm font-medium text-gray-700 hover:bg-gray-50 border-x border-gray-200">
              Hoy
            </button>
            <button onClick={() => onDiaChange(addDays(dia, 1))} className="px-2 md:px-3 py-2 hover:bg-gray-50 text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button onClick={() => onNuevoTurno(dia)} className="btn-primary flex items-center gap-1 px-3 py-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nuevo turno</span>
          </button>
        </div>
      </div>

      {/* Segunda fila: selector + stats */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-2 flex items-center justify-between gap-2 text-xs text-gray-500">
        {vistaSelector}
        <div className="flex items-center gap-3">
          <span>
            <strong className="text-gray-700">{turnosDia.length}</strong>{' '}
            <span className="hidden sm:inline">turno{turnosDia.length !== 1 ? 's' : ''}</span>
          </span>
          {entrevistasDia.length > 0 && (
            <span className="text-amber-600">
              <strong>{entrevistasDia.length}</strong>{' '}
              <span className="hidden sm:inline">entrevista{entrevistasDia.length !== 1 ? 's' : ''}</span>
            </span>
          )}
          {turnosDia.length === 0 && entrevistasDia.length === 0 && (
            <span className="text-gray-400 hidden sm:inline">Sin turnos este día</span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          <div className="w-12 md:w-16 flex-shrink-0 bg-white border-r border-gray-200 sticky left-0">
            {HORAS.map((hora) => (
              <div key={hora} className="h-16 border-b border-gray-100 flex items-start justify-end pr-1.5 md:pr-2 pt-1">
                <span className="text-[11px] text-gray-400">{hora}:00</span>
              </div>
            ))}
          </div>

          <div className="flex-1 relative">
            {HORAS.map((hora) => (
              <div
                key={hora}
                className="h-16 border-b border-gray-100 hover:bg-primary-fixed/20 cursor-pointer transition-colors"
                onClick={() => {
                  const f = new Date(dia)
                  f.setHours(hora, 0, 0, 0)
                  onNuevoTurno(f)
                }}
              />
            ))}

            {/* Google events */}
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
                >
                  <span className="text-gray-500 truncate block font-medium">{ev.titulo}</span>
                </div>
              )
            })}

            {/* Entrevistas */}
            {entrevistasDia.map((entrevista) => {
              const top = getTopOffset(entrevista.hora, entrevista.fecha, hi)
              const height = Math.max(getHeight(entrevista.duracion), 28)
              return (
                <div
                  key={entrevista.id}
                  className="absolute left-0.5 right-0.5 rounded-md px-2 py-1 cursor-pointer border text-xs bg-amber-100 border-amber-400 text-amber-900 hover:shadow-md transition-shadow overflow-hidden"
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={(e) => { e.stopPropagation(); onEntrevistaClick(entrevista) }}
                >
                  <div className="flex items-center gap-1 font-semibold truncate">
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-amber-900 text-[9px] font-bold flex items-center justify-center flex-shrink-0">E</span>
                    <span className="truncate flex-1">{entrevista.apellido}, {entrevista.nombre}</span>
                  </div>
                  {height > 40 && (
                    <div className="opacity-80 truncate mt-0.5">{entrevista.hora.slice(0, 5)} · {entrevista.duracion} min</div>
                  )}
                </div>
              )
            })}

            {/* Turnos */}
            {turnosDia.map((turno) => {
              const top = getTopOffsetISO(turno.fecha_hora, hi)
              const height = Math.max(getHeight(turno.duracion_min), 28)
              const p = turno.paciente
              return (
                <div
                  key={turno.id}
                  className={cn(
                    'absolute left-0.5 right-0.5 rounded-md px-2 py-1 cursor-pointer border text-xs hover:shadow-md transition-shadow overflow-hidden',
                    ESTADO_TURNO_COLORS[turno.estado]
                  )}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={(e) => { e.stopPropagation(); onTurnoClick(turno) }}
                >
                  <div className="flex items-center gap-1 font-semibold truncate">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', ESTADO_TURNO_DOT[turno.estado])} />
                    <span className="truncate flex-1">
                      {p ? formatNombreCompleto(p.nombre, p.apellido) : 'Paciente'}
                    </span>
                    {turno.serie_recurrente_id && (
                      <span className="flex-shrink-0 text-[10px] opacity-60">↻</span>
                    )}
                    {turno.pagado && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
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
        </div>
      </div>
    </div>
  )
}
