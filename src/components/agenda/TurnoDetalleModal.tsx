'use client'

import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  cn, formatNombreCompleto, ESTADO_TURNO_COLORS,
  ESTADO_TURNO_LABELS, ESTADO_TURNO_DOT,
} from '@/lib/utils'
import type { Turno, EstadoTurno } from '@/types/database'

interface TurnoDetalleModalProps {
  turno: Turno
  onClose: () => void
  onCambiarEstado: (id: string, estado: EstadoTurno) => void
  onEliminar: (id: string) => void
}

const ESTADOS_TRANSICION: EstadoTurno[] = ['pendiente', 'confirmado', 'realizado', 'no_asistio', 'cancelado']

const MODALIDAD_ICON: Record<string, string> = {
  presencial: '🏢',
  videollamada: '💻',
  telefonica: '📞',
}

export default function TurnoDetalleModal({
  turno, onClose, onCambiarEstado, onEliminar,
}: TurnoDetalleModalProps) {
  const paciente = turno.paciente
  const fecha = parseISO(turno.fecha_hora)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4 pointer-events-none">
      <div className="relative pointer-events-auto bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-sm overflow-y-auto overscroll-contain" style={{ maxHeight: '92dvh' }}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border', ESTADO_TURNO_COLORS[turno.estado])}>
              <span className={cn('w-1.5 h-1.5 rounded-full', ESTADO_TURNO_DOT[turno.estado])} />
              {ESTADO_TURNO_LABELS[turno.estado]}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Paciente */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Paciente</p>
            <p className="text-lg font-semibold text-gray-900">
              {paciente
                ? formatNombreCompleto(paciente.nombre, paciente.apellido)
                : 'Sin paciente'}
            </p>
            {paciente?.obra_social && (
              <p className="text-sm text-gray-500 mt-0.5">{paciente.obra_social}</p>
            )}
          </div>

          {/* Fecha y hora */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="capitalize">
                {format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{format(fecha, 'HH:mm')} hs · {turno.duracion_min} min</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-base leading-none">
                {MODALIDAD_ICON[turno.modalidad] ?? '📋'}
              </span>
              <span className="capitalize">{turno.modalidad}</span>
            </div>
            {turno.monto != null && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>$ {turno.monto.toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>

          {turno.notas && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Notas</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{turno.notas}</p>
            </div>
          )}

          {/* Cambiar estado */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Cambiar estado</p>
            <div className="flex flex-wrap gap-2">
              {ESTADOS_TRANSICION.filter((e) => e !== turno.estado).map((estado) => (
                <button
                  key={estado}
                  onClick={() => onCambiarEstado(turno.id, estado)}
                  className={cn(
                    'text-xs font-medium px-3 py-1.5 rounded-full border transition-opacity hover:opacity-80',
                    ESTADO_TURNO_COLORS[estado]
                  )}
                >
                  {ESTADO_TURNO_LABELS[estado]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={() => {
              if (confirm('¿Eliminás este turno? Esta acción no se puede deshacer.')) {
                onEliminar(turno.id)
              }
            }}
            className="w-full text-sm text-red-600 hover:text-red-700 hover:bg-red-50 py-2 rounded-lg transition-colors"
          >
            Eliminar turno
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
