'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Paciente, ModalidadTurno } from '@/types/database'
import MontoInput from '@/components/ui/MontoInput'
import PacienteSearchInput from './PacienteSearchInput'

const DURACIONES = [30, 45, 50, 60, 90]
const MODALIDADES: { value: ModalidadTurno; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'videollamada', label: 'Videollamada' },
  { value: 'telefonica', label: 'Telefónica' },
]
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface NuevoTurnoPageFormProps {
  pacientes: Paciente[]
  terapeutaId: string
}

function diaDeFecha(fechaStr: string): number {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export default function NuevoTurnoPageForm({ pacientes, terapeutaId }: NuevoTurnoPageFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const fechaParam = searchParams.get('fecha') ?? format(new Date(), 'yyyy-MM-dd')
  const horaParam = searchParams.get('hora') ?? '09:00'

  const [form, setForm] = useState({
    paciente_id: '',
    fecha: fechaParam,
    hora: horaParam,
    duracion_min: 50,
    modalidad: 'presencial' as ModalidadTurno,
    monto: '',
    notas: '',
  })
  const [esFijo, setEsFijo] = useState(false)
  const [diaSemana, setDiaSemana] = useState(diaDeFecha(fechaParam))
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
        router.push('/agenda')
        router.refresh()
      } catch {
        setError('Error al crear la serie. Intentá de nuevo.')
        setLoading(false)
      }
      return
    }

    const { error: dbError } = await supabase.from('turnos').insert({
      terapeuta_id: terapeutaId,
      paciente_id: form.paciente_id,
      fecha_hora: new Date(`${form.fecha}T${form.hora}:00`).toISOString(),
      duracion_min: Number(form.duracion_min),
      modalidad: form.modalidad,
      estado: 'pendiente',
      monto: form.monto ? Number(form.monto) : null,
      notas: form.notas || null,
    })

    if (dbError) {
      setError('Error al crear el turno. Intentá de nuevo.')
      setLoading(false)
      return
    }

    router.push('/agenda')
    router.refresh()
  }

  const pacientesActivos = pacientes.filter((p) => p.activo)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="card p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Paciente *</label>
        <PacienteSearchInput
          pacientes={pacientesActivos}
          value={form.paciente_id}
          onChange={(id) => setForm((prev) => ({ ...prev, paciente_id: id }))}
          className="input-field"
        />
      </div>

      <div className="card p-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha *</label>
          <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Hora *</label>
          <input type="time" name="hora" value={form.hora} onChange={handleChange} required className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Duración</label>
          <select name="duracion_min" value={form.duracion_min} onChange={handleChange} className="input-field">
            {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Modalidad</label>
          <select name="modalidad" value={form.modalidad} onChange={handleChange} className="input-field">
            {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Honorarios (ARS) <span className="text-gray-400 font-normal">opcional</span>
        </label>
        <MontoInput
          name="monto"
          value={form.monto}
          onChange={(raw) => setForm((prev) => ({ ...prev, monto: raw }))}
          className="input-field"
        />
      </div>

      <div className="card p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Notas <span className="text-gray-400 font-normal">opcional</span>
        </label>
        <textarea
          name="notas" value={form.notas} onChange={handleChange}
          rows={3} placeholder="Observaciones del turno..."
          className="input-field resize-none"
        />
      </div>

      {/* Toggle turno fijo */}
      <div className="card p-4">
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
          <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
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
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1 py-3">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className={cn('btn-primary flex-1 py-3', loading && 'opacity-70')}>
          {loading ? 'Guardando...' : esFijo ? 'Crear serie' : 'Crear turno'}
        </button>
      </div>
    </form>
  )
}
