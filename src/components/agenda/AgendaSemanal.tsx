'use client'

import { useState, useCallback } from 'react'
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, format, isSameDay, isToday,
  parseISO, addMinutes, isBefore, isAfter,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn, ESTADO_TURNO_COLORS, ESTADO_TURNO_DOT, ESTADO_TURNO_LABELS, formatNombreCompleto } from '@/lib/utils'
import type { Turno, Paciente, EstadoTurno } from '@/types/database'
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

export default function AgendaSemanal({ turnosIniciales, pacientes, terapeutaId }: AgendaSemanalProps) {
  const [semanaActual, setSemanaActual] = useState(new Date())
  const [turnos, setTurnos] = useState<Turno[]>(turnosIniciales)
  const [modalNuevo, setModalNuevo] = useState<{ fecha: Date } | null>(null)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno | null>(null)

  const inicioSemana = startOfWeek(semanaActual, { weekStartsOn: 1 })
  const finSemana = endOfWeek(semanaActual, { weekStartsOn: 1 })
  const dias = eachDayOfInterval({ start: inicioSemana, end: finSemana })

  function getTurnosDelDia(dia: Date) {
    return turnos
      .filter((t) => isSameDay(parseISO(t.fecha_hora), dia))
      .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
  }

  function getTopOffset(fechaHora: string): number {
    const fecha = parseISO(fechaHora)
    const horas = fecha.getHours() - HORA_INICIO
    const minutos = fecha.getMinutes()
    return (horas * 60 + minutos) * (64 / 60)
  }

  function getHeight(duracionMin: number): number {
    return duracionMin * (64 / 60)
  }

  function handleCeldaClick(dia: Date, hora: number) {
    const fecha = new Date(dia)
    fecha.setHours(hora, 0, 0, 0)
    setModalNuevo({ fecha })
  }

  const recargarTurnos = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('turnos')
      .select('*, paciente:pacientes(*)')
      .eq('terapeuta_id', terapeutaId)
      .gte('fecha_hora', inicioSemana.toISOString())
      .lte('fecha_hora', finSemana.toISOString())
      .order('fecha_hora')
    if (data) setTurnos(data as Turno[])
  }, [terapeutaId, inicioSemana, finSemana])

  async function cambiarEstado(turnoId: string, nuevoEstado: EstadoTurno) {
    const supabase = createClient()
    await supabase.from('turnos').update({ estado: nuevoEstado }).eq('id', turnoId)
    setTurnos((prev) =>
      prev.map((t) => (t.id === turnoId ? { ...t, estado: nuevoEstado } : t))
    )
    setTurnoSeleccionado((prev) => prev?.id === turnoId ? { ...prev, estado: nuevoEstado } : prev)
  }

  const turnosSemana = turnos.filter((t) => {
    const fecha = parseISO(t.fecha_hora)
    return !isBefore(fecha, inicioSemana) && !isAfter(fecha, finSemana)
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header de la agenda */}
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
            <button
              onClick={() => setSemanaActual((d) => subWeeks(d, 1))}
              className="px-3 py-2 hover:bg-gray-50 text-gray-600 transition-colors"
              aria-label="Semana anterior"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setSemanaActual(new Date())}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border-x border-gray-200 transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={() => setSemanaActual((d) => addWeeks(d, 1))}
              className="px-3 py-2 hover:bg-gray-50 text-gray-600 transition-colors"
              aria-label="Semana siguiente"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => setModalNuevo({ fecha: new Date() })}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo turno
          </button>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-6 text-xs text-gray-500">
        <span>
          <strong className="text-gray-700">{turnosSemana.length}</strong> turnos esta semana
        </span>
        <span>
          <strong className="text-green-600">
            {turnosSemana.filter((t) => t.estado === 'realizado').length}
          </strong> realizados
        </span>
        <span>
          <strong className="text-yellow-600">
            {turnosSemana.filter((t) => t.estado === 'pendiente' || t.estado === 'confirmado').length}
          </strong> pendientes
        </span>
        <span>
          <strong className="text-red-500">
            {turnosSemana.filter((t) => t.estado === 'cancelado' || t.estado === 'no_asistio').length}
          </strong> cancelados/ausentes
        </span>
      </div>

      {/* Grilla semanal */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-w-[800px]">
          {/* Columna de horas */}
          <div className="w-16 flex-shrink-0 bg-white border-r border-gray-200 sticky left-0 z-10">
            <div className="h-14 border-b border-gray-200" /> {/* Header espaciador */}
            {HORAS.map((hora) => (
              <div
                key={hora}
                className="h-16 border-b border-gray-100 flex items-start justify-end pr-2 pt-1"
              >
                <span className="text-xs text-gray-400 font-medium">
                  {hora}:00
                </span>
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          {dias.map((dia) => {
            const turnosDia = getTurnosDelDia(dia)
            const esHoy = isToday(dia)

            return (
              <div key={dia.toISOString()} className="flex-1 min-w-0 border-r border-gray-200 last:border-r-0">
                {/* Header del día */}
                <div className={cn(
                  'h-14 border-b border-gray-200 flex flex-col items-center justify-center sticky top-0 z-10 bg-white',
                  esHoy && 'bg-primary-50'
                )}>
                  <span className={cn(
                    'text-xs font-medium uppercase tracking-wider',
                    esHoy ? 'text-primary-600' : 'text-gray-500'
                  )}>
                    {format(dia, 'EEE', { locale: es })}
                  </span>
                  <span className={cn(
                    'text-lg font-semibold mt-0.5',
                    esHoy
                      ? 'w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm'
                      : 'text-gray-900'
                  )}>
                    {format(dia, 'd')}
                  </span>
                </div>

                {/* Celdas horarias con turnos superpuestos */}
                <div className="relative">
                  {/* Celdas vacías clicables */}
                  {HORAS.map((hora) => (
                    <div
                      key={hora}
                      className="h-16 border-b border-gray-100 hover:bg-primary-50/30 cursor-pointer transition-colors group"
                      onClick={() => handleCeldaClick(dia, hora)}
                    >
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center h-full">
                        <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>
                  ))}

                  {/* Turnos posicionados absolutamente */}
                  {turnosDia.map((turno) => {
                    const top = getTopOffset(turno.fecha_hora)
                    const height = Math.max(getHeight(turno.duracion_min), 28)
                    const paciente = turno.paciente

                    return (
                      <div
                        key={turno.id}
                        className={cn(
                          'absolute left-0.5 right-0.5 rounded-md px-2 py-1 cursor-pointer border text-xs',
                          'hover:shadow-md transition-shadow overflow-hidden',
                          ESTADO_TURNO_COLORS[turno.estado]
                        )}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setTurnoSeleccionado(turno)
                        }}
                      >
                        <div className="flex items-center gap-1 font-semibold truncate">
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', ESTADO_TURNO_DOT[turno.estado])} />
                          <span className="truncate">
                            {paciente
                              ? formatNombreCompleto(paciente.nombre, paciente.apellido)
                              : 'Paciente'}
                          </span>
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
            )
          })}
        </div>
      </div>

      {/* Modal nuevo turno */}
      {modalNuevo && (
        <NuevoTurnoModal
          fechaInicial={modalNuevo.fecha}
          pacientes={pacientes}
          terapeutaId={terapeutaId}
          onClose={() => setModalNuevo(null)}
          onCreado={(nuevoTurno) => {
            setTurnos((prev) => [...prev, nuevoTurno])
            setModalNuevo(null)
          }}
        />
      )}

      {/* Modal detalle turno */}
      {turnoSeleccionado && (
        <TurnoDetalleModal
          turno={turnoSeleccionado}
          onClose={() => setTurnoSeleccionado(null)}
          onCambiarEstado={cambiarEstado}
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
