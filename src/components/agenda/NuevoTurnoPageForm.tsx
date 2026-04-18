'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn, formatNombreCompleto } from '@/lib/utils'
import type { Paciente, ModalidadTurno } from '@/types/database'
import MontoInput from '@/components/ui/MontoInput'

const DURACIONES = [30, 45, 50, 60, 90]
const MODALIDADES: { value: ModalidadTurno; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'videollamada', label: 'Videollamada' },
  { value: 'telefonica', label: 'Telefónica' },
]

interface NuevoTurnoPageFormProps {
  pacientes: Paciente[]
  terapeutaId: string
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
    if (!form.paciente_id) { setError('Seleccioná un paciente'); return }
    setLoading(true)
    setError(null)

    const fechaHora = new Date(`${form.fecha}T${form.hora}:00`)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('turnos').insert({
      terapeuta_id: terapeutaId,
      paciente_id: form.paciente_id,
      fecha_hora: fechaHora.toISOString(),
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

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1 py-3">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className={cn('btn-primary flex-1 py-3', loading && 'opacity-70')}>
          {loading ? 'Guardando...' : 'Crear turno'}
        </button>
      </div>
    </form>
  )
}
