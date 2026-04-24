'use client'

import { useState } from 'react'
import { format, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Paciente, Turno, ModalidadTurno } from '@/types/database'
import MontoInput from '@/components/ui/MontoInput'
import PacienteSearchInput from './PacienteSearchInput'

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
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function diaDeFecha(fechaStr: string): number {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export default function NuevoTurnoModal({
  fechaInicial, pacientes, terapeutaId, onClose, onCreado,
}: NuevoTurnoModalProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    paciente_id: '',
    fecha: format(fechaInicial, 'yyyy-MM-dd'),
    hora: format(fechaInicial, 'HH:mm'),
    duracion_min: 50,
    modalidad: 'presencial' as ModalidadTurno,
    monto: '',
    notas: '',
  })
  const [esFijo, setEsFijo] = useState(false)
  const [diaSemana, setDiaSemana] = useState(diaDeFecha(format(fechaInicial, 'yyyy-MM-dd')))
  const [fechaFin, setFechaFin] = useState(format(addMonths(new Date(), 12), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'fecha') setDiaSemana(diaDeFecha(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente_id) { setError('Seleccioná un paciente'); return }
    setLoading(true)
    setError(null)

    const supabase = createClient()

    if (esFijo) {
      try {
        const { generarFechasSerie, detectarConflictos, crearSerieTurnos } = await import('@/lib/recurrentes')
        const [y, m, d] = form.fecha.split('-').map(Number)
        const [yf, mf, df] = fechaFin.split('-').map(Number)
        const fechas = generarFechasSerie(diaSemana, new Date(y, m - 1, d), new Date(yf, mf - 1, df))
        const conflictos = await detectarConflictos(terapeutaId, fechas, form.hora, Number(form.duracion_min), supabase)
        const validas = fechas.filter((f) => !conflictos.some((c) => c.getTime() === f.getTime()))
        await crearSerieTurnos(
          crypto.randomUUID(),
          terapeutaId,
          form.paciente_id,
          validas,
          form.hora,
          Number(form.duracion_min),
          form.monto ? Number(form.monto) : null,
          supabase
        )
        router.refresh()
        onClose()
      } catch {
        setError('Error al crear la serie. Intentá de nuevo.')
        setLoading(false)
      }
      return
    }

    const fechaHora = new Date(`${form.fecha}T${form.hora}:00`)
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
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
            <PacienteSearchInput
              pacientes={pacientesActivos}
              value={form.paciente_id}
              onChange={(id) => setForm((prev) => ({ ...prev, paciente_id: id }))}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
              <input type="time" name="hora" value={form.hora} onChange={handleChange} required className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
              <select name="duracion_min" value={form.duracion_min} onChange={handleChange} className="input-field">
                {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
              <select name="modalidad" value={form.modalidad} onChange={handleChange} className="input-field">
                {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Honorarios (ARS) <span className="text-gray-400 font-normal ml-1">opcional</span>
            </label>
            <MontoInput
              name="monto"
              value={form.monto}
              onChange={(raw) => setForm((prev) => ({ ...prev, monto: raw }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas <span className="text-gray-400 font-normal ml-1">opcional</span>
            </label>
            <textarea
              name="notas" value={form.notas} onChange={handleChange}
              rows={2} placeholder="Observaciones del turno..."
              className="input-field resize-none"
            />
          </div>

          {/* Toggle turno fijo */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">¿Es un turno fijo?</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {esFijo ? 'Se crearán turnos recurrentes' : 'Turno único'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEsFijo((v) => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                esFijo ? 'bg-primary' : 'bg-gray-300'
              )}
            >
              <span className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out',
                esFijo ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>

          {esFijo && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Repetir todos los</label>
                  <select
                    value={diaSemana}
                    onChange={(e) => setDiaSemana(Number(e.target.value))}
                    className="input-field"
                  >
                    {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de fin</label>
                  <input
                    type="date"
                    value={fechaFin}
                    min={form.fecha}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
              <p className="text-xs text-primary/80">
                Todos los {DIAS_SEMANA[diaSemana].toLowerCase()} hasta el{' '}
                {format(new Date(fechaFin + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn('btn-primary flex-1', loading && 'opacity-70')}
            >
              {loading ? 'Guardando...' : esFijo ? 'Crear serie' : 'Crear turno'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  )
}
