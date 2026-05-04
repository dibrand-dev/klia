'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import SlideOver from '@/components/ui/SlideOver'
import type { Entrevista } from '@/types/database'

interface EntrevistaDetalleModalProps {
  entrevista: Entrevista
  onClose: () => void
  onEntrevistaActualizada: (e: Entrevista) => void
}

const ESTADOS = ['pendiente', 'realizada', 'cancelada'] as const
const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  convertida: 'Convertida',
}
const DURACIONES = [30, 45, 50, 60, 90]

export default function EntrevistaDetalleModal({
  entrevista,
  onClose,
  onEntrevistaActualizada,
}: EntrevistaDetalleModalProps) {
  const router = useRouter()
  const [estado, setEstado] = useState(entrevista.estado)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [confirmConvertir, setConfirmConvertir] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editando, setEditando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    nombre: entrevista.nombre,
    apellido: entrevista.apellido,
    telefono: entrevista.telefono ?? '',
    email: entrevista.email ?? '',
    fecha: entrevista.fecha,
    hora: entrevista.hora.slice(0, 5),
    duracion: entrevista.duracion,
    costo: entrevista.costo != null ? String(entrevista.costo) : '',
    notas: entrevista.notas ?? '',
  })

  const titulo = `${entrevista.apellido}, ${entrevista.nombre} | Entrevista`
  const fechaLabel = (() => {
    const d = parseISO(entrevista.fecha + 'T12:00:00')
    return format(d, "EEEE d 'de' MMMM yyyy", { locale: es })
  })()

  async function guardarEdicion() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const updates = {
      nombre: editForm.nombre.trim(),
      apellido: editForm.apellido.trim(),
      telefono: editForm.telefono.trim() || null,
      email: editForm.email.trim() || null,
      fecha: editForm.fecha,
      hora: editForm.hora,
      duracion: Number(editForm.duracion),
      costo: editForm.costo ? Number(editForm.costo) : null,
      notas: editForm.notas.trim() || null,
    }
    const { error: dbError } = await supabase
      .from('entrevistas')
      .update(updates)
      .eq('id', entrevista.id)
    if (dbError) { setError('Error al guardar cambios.'); setSaving(false); return }
    if (entrevista.google_event_id) {
      fetch('/api/google-calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrevista_id: entrevista.id, action: 'update' }),
      }).catch(() => {})
    }
    onEntrevistaActualizada({ ...entrevista, ...updates })
    setEditando(false)
    setSaving(false)
  }

  async function handleEstadoChange(nuevoEstado: string) {
    setCambiandoEstado(true)
    setError(null)
    const res = await fetch(`/api/entrevistas/${entrevista.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_estado', estado: nuevoEstado }),
    })
    if (!res.ok) {
      setError('Error al actualizar el estado.')
      setCambiandoEstado(false)
      return
    }
    if (nuevoEstado === 'cancelada') {
      fetch('/api/google-calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrevista_id: entrevista.id, action: 'delete' }),
      }).catch(() => {})
    }
    const actualizada = { ...entrevista, estado: nuevoEstado as Entrevista['estado'] }
    setEstado(nuevoEstado as Entrevista['estado'])
    onEntrevistaActualizada(actualizada)
    setCambiandoEstado(false)
  }

  async function handleConvertir() {
    setConvirtiendo(true)
    setError(null)
    const res = await fetch(`/api/entrevistas/${entrevista.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convertir' }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al convertir en paciente.')
      setConvirtiendo(false)
      return
    }
    onClose()
    router.push(`/pacientes/${data.paciente_id}`)
  }

  const yaConvertida = estado === 'convertida'

  // ─── Modo editar ────────────────────────────────────────────────
  if (editando) {
    return (
      <SlideOver open onClose={onClose} title={titulo}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Editar entrevista</h3>
          <button onClick={() => setEditando(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" value={editForm.nombre}
                onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
              <input type="text" value={editForm.apellido}
                onChange={(e) => setEditForm((p) => ({ ...p, apellido: e.target.value }))}
                className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input type="tel" value={editForm.telefono}
                onChange={(e) => setEditForm((p) => ({ ...p, telefono: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" value={editForm.fecha}
                onChange={(e) => setEditForm((p) => ({ ...p, fecha: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
              <input type="time" value={editForm.hora}
                onChange={(e) => setEditForm((p) => ({ ...p, hora: e.target.value }))}
                className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
              <select value={editForm.duracion}
                onChange={(e) => setEditForm((p) => ({ ...p, duracion: Number(e.target.value) }))}
                className="input-field">
                {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo (ARS)</label>
              <input type="number" min="0" step="100" value={editForm.costo}
                onChange={(e) => setEditForm((p) => ({ ...p, costo: e.target.value }))}
                className="input-field" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={editForm.notas}
              onChange={(e) => setEditForm((p) => ({ ...p, notas: e.target.value }))}
              rows={3} className="input-field resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditando(false)} className="btn-secondary flex-1 py-3">Cancelar</button>
            <button
              onClick={guardarEdicion}
              disabled={saving || !editForm.nombre.trim() || !editForm.apellido.trim() || !editForm.fecha || !editForm.hora}
              className={cn('btn-primary flex-1 py-3', saving && 'opacity-70')}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </SlideOver>
    )
  }

  // ─── Vista normal ────────────────────────────────────────────────
  return (
    <SlideOver open onClose={onClose} title={titulo}>
      {/* Sub-header con botón editar */}
      <div className="flex items-center justify-end px-5 pt-3 pb-1">
        <button
          onClick={() => setEditando(true)}
          className="p-2 text-gray-400 hover:text-primary hover:bg-primary-fixed/20 rounded-lg transition-colors"
          title="Editar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      <div className="px-5 pb-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
        )}

        {/* Fecha y hora */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="capitalize font-medium">{fechaLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{entrevista.hora.slice(0, 5)} hs · {entrevista.duracion} min</span>
          </div>
        </div>

        {/* Datos de contacto */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Datos de contacto</p>
          <div className="space-y-1.5">
            {entrevista.telefono ? (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${entrevista.telefono.replace(/[^\d+]/g, '')}`} className="text-primary hover:underline">
                  {entrevista.telefono}
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin teléfono</p>
            )}
            {entrevista.email && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href={`mailto:${entrevista.email}`} className="text-primary hover:underline">
                  {entrevista.email}
                </a>
              </div>
            )}
            {entrevista.costo != null && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>$ {entrevista.costo.toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>
        </div>

        {entrevista.notas && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Notas</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{entrevista.notas}</p>
          </div>
        )}

        {/* Estado */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Estado</p>
          {yaConvertida ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                ✅ Convertida en paciente
              </span>
              {entrevista.paciente_id && (
                <Link
                  href={`/pacientes/${entrevista.paciente_id}`}
                  onClick={onClose}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Ver ficha de {entrevista.nombre} {entrevista.apellido} →
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  onClick={() => handleEstadoChange(e)}
                  disabled={cambiandoEstado || estado === e}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
                    estado === e
                      ? 'bg-amber-100 border-amber-400 text-amber-900'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-800'
                  }`}
                >
                  {ESTADO_LABELS[e]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Convertir en paciente */}
        {!yaConvertida && estado !== 'cancelada' && (
          <div className="pt-2 border-t border-gray-100 space-y-3">
            {confirmConvertir ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-green-800">
                  Se creará un nuevo paciente con los datos de esta entrevista. Podrás completar el resto de la ficha después.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmConvertir(false)}
                    disabled={convirtiendo}
                    className="btn-secondary flex-1 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConvertir}
                    disabled={convirtiendo}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-70"
                  >
                    {convirtiendo ? 'Convirtiendo...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmConvertir(true)}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Convertir en paciente
              </button>
            )}

            <button
              onClick={() => handleEstadoChange('cancelada')}
              disabled={cambiandoEstado}
              className="w-full text-sm text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
            >
              {cambiandoEstado ? 'Cancelando...' : 'Cancelar entrevista'}
            </button>
          </div>
        )}
      </div>
    </SlideOver>
  )
}
