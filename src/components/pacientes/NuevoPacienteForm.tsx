'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const OBRAS_SOCIALES_COMUNES = [
  'OSDE', 'Swiss Medical', 'Galeno', 'IOMA', 'PAMI', 'OMINT',
  'Medicus', 'Sancor Salud', 'Accord Salud', 'Particular',
]

export default function NuevoPacienteForm({ terapeutaId }: { terapeutaId: string }) {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    fecha_nacimiento: '',
    telefono: '',
    email: '',
    obra_social: '',
    numero_afiliado: '',
    notas: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: dbError } = await supabase.from('pacientes').insert({
      terapeuta_id: terapeutaId,
      nombre: form.nombre,
      apellido: form.apellido,
      dni: form.dni || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      telefono: form.telefono || null,
      email: form.email || null,
      obra_social: form.obra_social || null,
      numero_afiliado: form.numero_afiliado || null,
      notas: form.notas || null,
      activo: true,
    })

    if (dbError) {
      setError('Error al guardar el paciente. Intentá de nuevo.')
      setLoading(false)
      return
    }

    router.push('/pacientes')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Datos personales */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Datos personales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input name="nombre" type="text" value={form.nombre} onChange={handleChange}
              required placeholder="María" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
            <input name="apellido" type="text" value={form.apellido} onChange={handleChange}
              required placeholder="García" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
            <input name="dni" type="text" value={form.dni} onChange={handleChange}
              placeholder="12.345.678" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
            <input name="fecha_nacimiento" type="date" value={form.fecha_nacimiento}
              onChange={handleChange} className="input-field" />
          </div>
        </div>
      </div>

      {/* Contacto */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Contacto</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input name="telefono" type="tel" value={form.telefono} onChange={handleChange}
              placeholder="+54 11 1234-5678" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="paciente@email.com" className="input-field" />
          </div>
        </div>
      </div>

      {/* Cobertura médica */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Cobertura médica</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Obra social / Prepaga</label>
            <input
              name="obra_social"
              type="text"
              value={form.obra_social}
              onChange={handleChange}
              placeholder="OSDE, IOMA, Particular..."
              list="obras-sociales"
              className="input-field"
            />
            <datalist id="obras-sociales">
              {OBRAS_SOCIALES_COMUNES.map((os) => (
                <option key={os} value={os} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° de afiliado</label>
            <input name="numero_afiliado" type="text" value={form.numero_afiliado}
              onChange={handleChange} placeholder="123456789" className="input-field" />
          </div>
        </div>
      </div>

      {/* Notas clínicas */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Notas internas</h2>
        <textarea
          name="notas"
          value={form.notas}
          onChange={handleChange}
          rows={3}
          placeholder="Motivo de consulta, derivación, observaciones..."
          className="input-field resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Solo visible para vos.</p>
      </div>

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className={cn('btn-primary', loading && 'opacity-70')}>
          {loading ? 'Guardando...' : 'Guardar paciente'}
        </button>
      </div>
    </form>
  )
}
