'use client'

import { useState } from 'react'
import Link from 'next/link'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  cn, formatNombreCompleto, ESTADO_TURNO_COLORS,
  ESTADO_TURNO_LABELS, ESTADO_TURNO_DOT,
} from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Turno, EstadoTurno } from '@/types/database'
import MontoInput from '@/components/ui/MontoInput'

interface TurnoDetalleModalProps {
  turno: Turno
  onClose: () => void
  onTurnoActualizado: (turno: Turno) => void
  onEliminar: (id: string) => void
}

const ESTADOS_TRANSICION: EstadoTurno[] = ['pendiente', 'confirmado', 'realizado', 'no_asistio', 'cancelado']
const DURACIONES = [30, 45, 50, 60, 90]

const MODALIDAD_ICON: Record<string, string> = {
  presencial: '🏢',
  videollamada: '💻',
  telefonica: '📞',
}

type Modo = 'ver' | 'editar' | 'cancelando' | 'realizando'

function ModalShell({ children, onBackdropClick }: { children: React.ReactNode; onBackdropClick: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onBackdropClick} />
      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4 pointer-events-none">
        <div
          className="relative pointer-events-auto bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-sm overflow-y-auto overscroll-contain"
          style={{ maxHeight: '92dvh' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default function TurnoDetalleModal({ turno, onClose, onTurnoActualizado, onEliminar }: TurnoDetalleModalProps) {
  const paciente = turno.paciente
  const fecha = parseISO(turno.fecha_hora)

  const [modo, setModo] = useState<Modo>('ver')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    fecha: format(fecha, 'yyyy-MM-dd'),
    hora: format(fecha, 'HH:mm'),
    duracion_min: turno.duracion_min,
    monto: turno.monto != null ? String(turno.monto) : '',
    notas: turno.notas ?? '',
  })
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [notaSesion, setNotaSesion] = useState('')
  const [realizandoExito, setRealizandoExito] = useState(false)
  const [notaFueGuardada, setNotaFueGuardada] = useState(false)

  async function guardarEdicion() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const fechaHora = new Date(`${editForm.fecha}T${editForm.hora}:00`)
    const { error: dbError } = await supabase
      .from('turnos')
      .update({
        fecha_hora: fechaHora.toISOString(),
        duracion_min: Number(editForm.duracion_min),
        monto: editForm.monto ? Number(editForm.monto) : null,
        notas: editForm.notas || null,
      })
      .eq('id', turno.id)
    if (dbError) { setError('Error al guardar cambios.'); setLoading(false); return }
    onTurnoActualizado({
      ...turno,
      fecha_hora: fechaHora.toISOString(),
      duracion_min: Number(editForm.duracion_min),
      monto: editForm.monto ? Number(editForm.monto) : null,
      notas: editForm.notas || null,
    })
    setModo('ver')
    setLoading(false)
  }

  async function confirmarCancelacion() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('turnos')
      .update({ estado: 'cancelado', motivo_cancelacion: motivoCancelacion || null })
      .eq('id', turno.id)
    if (dbError) { setError('Error al cancelar.'); setLoading(false); return }
    onTurnoActualizado({ ...turno, estado: 'cancelado', motivo_cancelacion: motivoCancelacion || null })
    setModo('ver')
    setLoading(false)
  }

  async function confirmarRealizado(guardarNota: boolean) {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('turnos').update({ estado: 'realizado' }).eq('id', turno.id)
    if (dbError) { setError('Error al actualizar estado.'); setLoading(false); return }
    const habeNota = guardarNota && !!notaSesion.trim()
    if (habeNota) {
      await supabase.from('notas_clinicas').insert({
        terapeuta_id: turno.terapeuta_id,
        paciente_id: turno.paciente_id,
        turno_id: turno.id,
        fecha: format(fecha, 'yyyy-MM-dd'),
        contenido: notaSesion.trim(),
      })
    }
    onTurnoActualizado({ ...turno, estado: 'realizado' })
    setNotaFueGuardada(habeNota)
    setRealizandoExito(true)
    setLoading(false)
  }

  async function cambiarEstadoDirecto(nuevoEstado: EstadoTurno) {
    if (nuevoEstado === 'cancelado') { setModo('cancelando'); return }
    if (nuevoEstado === 'realizado') { setModo('realizando'); return }
    setLoading(true)
    const supabase = createClient()
    await supabase.from('turnos').update({ estado: nuevoEstado }).eq('id', turno.id)
    onTurnoActualizado({ ...turno, estado: nuevoEstado })
    setLoading(false)
  }

  async function togglePagado() {
    const nuevoPagado = !turno.pagado
    const supabase = createClient()
    await supabase.from('turnos').update({ pagado: nuevoPagado }).eq('id', turno.id)
    onTurnoActualizado({ ...turno, pagado: nuevoPagado })
  }

  // ─── Modo editar ───────────────────────────────────────────────
  if (modo === 'editar') {
    return (
      <ModalShell onBackdropClick={() => setModo('ver')}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Editar turno</h3>
          <button onClick={() => setModo('ver')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" value={editForm.fecha}
                onChange={(e) => setEditForm((p) => ({ ...p, fecha: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
              <input type="time" value={editForm.hora}
                onChange={(e) => setEditForm((p) => ({ ...p, hora: e.target.value }))}
                className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
            <select value={editForm.duracion_min}
              onChange={(e) => setEditForm((p) => ({ ...p, duracion_min: Number(e.target.value) }))}
              className="input-field">
              {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Honorarios (ARS)</label>
            <MontoInput name="monto" value={editForm.monto}
              onChange={(raw) => setEditForm((p) => ({ ...p, monto: raw }))}
              className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={editForm.notas}
              onChange={(e) => setEditForm((p) => ({ ...p, notas: e.target.value }))}
              rows={3} className="input-field resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModo('ver')} className="btn-secondary flex-1 py-3">Cancelar</button>
            <button onClick={guardarEdicion} disabled={loading}
              className={cn('btn-primary flex-1 py-3', loading && 'opacity-70')}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </ModalShell>
    )
  }

  // ─── Modo cancelando ──────────────────────────────────────────
  if (modo === 'cancelando') {
    return (
      <ModalShell onBackdropClick={() => setModo('ver')}>
        <div className="p-5 space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">Cancelar turno</h3>
            <p className="text-sm text-gray-500 mt-1">Podés agregar el motivo (opcional)</p>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <textarea
            value={motivoCancelacion}
            onChange={(e) => setMotivoCancelacion(e.target.value)}
            rows={3}
            placeholder="Motivo de cancelación..."
            className="input-field resize-none"
          />
          <div className="flex gap-3">
            <button onClick={() => setModo('ver')} className="btn-secondary flex-1 py-3">Volver</button>
            <button onClick={confirmarCancelacion} disabled={loading}
              className={cn('flex-1 py-3 px-4 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors', loading && 'opacity-70')}>
              {loading ? 'Cancelando...' : 'Confirmar cancelación'}
            </button>
          </div>
        </div>
      </ModalShell>
    )
  }

  // ─── Modo realizando ──────────────────────────────────────────
  if (modo === 'realizando') {
    if (realizandoExito) {
      return (
        <ModalShell onBackdropClick={() => { setModo('ver'); setRealizandoExito(false) }}>
          <div className="p-5 space-y-4 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Sesión registrada</h3>
              <p className="text-sm text-gray-500 mt-1">El turno fue marcado como realizado</p>
            </div>
            {notaFueGuardada && (
              <Link
                href={`/pacientes/${turno.paciente_id}/historial`}
                onClick={() => { setModo('ver'); setRealizandoExito(false); onClose() }}
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Ver nota en historial →
              </Link>
            )}
            <button
              onClick={() => { setModo('ver'); setRealizandoExito(false) }}
              className="btn-secondary w-full py-3"
            >
              Listo
            </button>
          </div>
        </ModalShell>
      )
    }

    return (
      <ModalShell onBackdropClick={() => setModo('ver')}>
        <div className="p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Marcar como realizado</h3>
            <p className="text-sm text-gray-500 mt-0.5">Podés agregar una nota de sesión (opcional)</p>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota de sesión (opcional)</label>
            <textarea
              value={notaSesion}
              onChange={(e) => setNotaSesion(e.target.value)}
              rows={5}
              placeholder="¿Qué trabajaron en esta sesión?"
              className="input-field resize-none"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModo('ver')} className="btn-secondary flex-1 py-3 text-sm">Volver</button>
            <button onClick={() => confirmarRealizado(false)} disabled={loading}
              className={cn('flex-1 py-3 rounded-xl text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors', loading && 'opacity-50')}>
              Guardar sin nota
            </button>
            <button onClick={() => confirmarRealizado(true)} disabled={loading || !notaSesion.trim()}
              className={cn('flex-1 py-3 btn-primary text-sm', (loading || !notaSesion.trim()) && 'opacity-50')}>
              Guardar con nota
            </button>
          </div>
        </div>
      </ModalShell>
    )
  }

  // ─── Modo ver ─────────────────────────────────────────────────
  return (
    <ModalShell onBackdropClick={onClose}>
      <div className="flex items-center justify-between p-5 border-b border-gray-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border', ESTADO_TURNO_COLORS[turno.estado])}>
            <span className={cn('w-1.5 h-1.5 rounded-full', ESTADO_TURNO_DOT[turno.estado])} />
            {ESTADO_TURNO_LABELS[turno.estado]}
          </span>
          {turno.pagado && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Pagado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setModo('editar')}
            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Paciente */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Paciente</p>
          {paciente ? (
            <Link href={`/pacientes/${turno.paciente_id}`} onClick={onClose} className="group inline-flex items-center gap-1.5">
              <p className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {formatNombreCompleto(paciente.nombre, paciente.apellido)}
              </p>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          ) : (
            <p className="text-lg font-semibold text-gray-900">Sin paciente</p>
          )}
          {paciente?.obra_social && (
            <p className="text-sm text-gray-500 mt-0.5">{paciente.obra_social}</p>
          )}
        </div>

        {/* Info fecha/hora */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="capitalize">{format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}</span>
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

        {turno.motivo_cancelacion && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Motivo de cancelación</p>
            <p className="text-sm text-gray-700 bg-red-50 rounded-lg p-3 border border-red-100">{turno.motivo_cancelacion}</p>
          </div>
        )}

        {/* Toggle pagado */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900">Honorarios</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {turno.pagado ? 'Marcado como pagado' : 'Pendiente de pago'}
            </p>
          </div>
          <button
            onClick={togglePagado}
            className={cn(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
              turno.pagado ? 'bg-green-500' : 'bg-gray-300'
            )}
          >
            <span className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out',
              turno.pagado ? 'translate-x-5' : 'translate-x-0'
            )} />
          </button>
        </div>

        {/* Cambiar estado */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Cambiar estado</p>
          <div className="flex flex-wrap gap-2">
            {ESTADOS_TRANSICION.filter((e) => e !== turno.estado).map((estado) => (
              <button
                key={estado}
                onClick={() => cambiarEstadoDirecto(estado)}
                disabled={loading}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-50',
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
    </ModalShell>
  )
}
