'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn, formatNombreCompleto } from '@/lib/utils'
import type { Paciente, Turno, ModalidadTurno } from '@/types/database'

interface NuevoTurnoModalProps {
  fechaInicial: Date
  pacientes: Paciente[]
  terapeutaId: string
  onClose: () => void
  onCreado: (turno: Turno) => void
}

const DURACIONES = [30, 45, 50, 60, 90]
const MODALIDADES: { value: ModalidadTurno; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'videollamada', label: 'Videollamada' },
  { value: 'telefonica', label: 'Telefónica' },
]

export default function NuevoTurnoModal({
  fechaInicial, pacientes, terapeutaId, onClose, onCreado,
}: NuevoTurnoModalProps) {
  const [form, setForm] = useState({
    paciente_id: '',
    fecha: format(fechaInicial, 'yyyy-MM-dd'),
    hora: format(fechaInicial, 'HH:mm'),
    duracion_min: 50,
    modalidad: 'presencial' as ModalidadTurno,
    monto: '',
    notas: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente_id) {
      setError('Seleccioná un paciente')
      return
    }

    setLoading(true)
    setError(null)

    const fechaHora = new Date(`${form.fecha}T${form.hora}:00`)
    const supabase = createClient()

    const { data, error: dbError } = await supabase
      .from('turnos')
      .insert({
        terapeuta_id: terapeutaId,
        paciente_id: form.paciente_id,
        fecha_hora: fechaHora.toISOString(),
        duracion_min: Number(form.duracion_min),
        modalidad: form.modalidad,
        estado: 'pendiente',
        monto: form.monto ? Number(form.monto) : null,
        notas: form.notas || null,
      })
      .select('*, paciente:pacientes(*)')
      .single()

    if (dbError) {
      setError('Error al crear el turno. Intentá de nuevo.')
      setLoading(false)
      return
    }

    onCreado(data as unknown as Turno)
  }

  const pacientesActivos = pacientes.filter((p) => p.activo)

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop separado para no interferir con el scroll del modal */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Panel del modal */}
      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4 pointer-events-none">
      <div className="relative pointer-events-auto bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:max-w-md overflow-y-auto overscroll-contain" style={{ maxHeight: '92dvh' }}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo turno</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paciente *</label>
            <select
              name="paciente_id"
              value={form.paciente_id}
              onChange={handleChange}
              required
              className="input-field"
            >
              <option value="">Seleccioná un paciente...</option>
              {pacientesActivos.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatNombreCompleto(p.nombre, p.apellido)}
                  {p.obra_social ? ` — ${p.obra_social}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
              <input
                type="time"
                name="hora"
                value={form.hora}
                onChange={handleChange}
                required
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
              <select name="duracion_min" value={form.duracion_min} onChange={handleChange} className="input-field">
                {DURACIONES.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
              <select name="modalidad" value={form.modalidad} onChange={handleChange} className="input-field">
                {MODALIDADES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Honorarios (ARS)
              <span className="text-gray-400 font-normal ml-1">opcional</span>
            </label>
            <input
              type="number"
              name="monto"
              value={form.monto}
              onChange={handleChange}
              placeholder="Ej: 15000"
              min="0"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
              <span className="text-gray-400 font-normal ml-1">opcional</span>
            </label>
            <textarea
              name="notas"
              value={form.notas}
              onChange={handleChange}
              rows={2}
              placeholder="Observaciones del turno..."
              className="input-field resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn('btn-primary flex-1', loading && 'opacity-70')}
            >
              {loading ? 'Guardando...' : 'Crear turno'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  )
}
