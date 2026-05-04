'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

const ESPECIALIDADES = [
  'Acompañamiento Terapéutico',
  'Administración de Salud',
  'Cardiología',
  'Clínica Médica',
  'Dermatología',
  'Endocrinología',
  'Estimulación Temprana',
  'Fisiatría',
  'Fonoaudiología',
  'Gastroenterología',
  'Ginecología y Obstetricia',
  'Kinesiología',
  'Medicina de Familia',
  'Musicoterapia',
  'Neurología',
  'Neuropsicología',
  'Nutrición',
  'Oftalmología',
  'Pediatría',
  'Psicología',
  'Psicopedagogía',
  'Psiquiatría',
  'Psiquiatría Infanto-Juvenil',
  'Secretariado Médico',
  'Terapia Ocupacional',
  'Traumatología',
  'Urología',
  'Otro / No listado',
]

const inputCls =
  'w-full bg-surface-container-high border border-outline-variant/15 text-on-surface rounded-lg px-4 py-3 text-sm focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none'
const labelCls =
  'block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-2'

export default function PerfilProfesional({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const [form, setForm] = useState({
    especialidad: profile?.especialidad ?? '',
    matricula: profile?.matricula ?? '',
    telefono: profile?.telefono ?? '',
    domicilio: profile?.domicilio ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        especialidad: form.especialidad || null,
        matricula: form.matricula || null,
        telefono: form.telefono || null,
        domicilio: form.domicilio || null,
      })
      .eq('id', profile?.id ?? '')

    if (dbError) {
      setError('Error al guardar los cambios. Intentá de nuevo.')
      setLoading(false)
      return
    }
    setSaved(true)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_8px_24px_rgba(0,26,72,0.06)]">
      <h2 className="font-semibold text-on-surface mb-5 flex items-center gap-2 text-sm">
        <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
        Perfil profesional
      </h2>

      {/* Datos de identidad (solo lectura) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 bg-surface-container-high/40 rounded-lg border border-outline-variant/10">
        <div>
          <p className={labelCls}>Nombre completo</p>
          <p className="text-sm text-on-surface font-medium">
            {profile?.nombre} {profile?.apellido}
          </p>
        </div>
        <div>
          <p className={labelCls}>Email</p>
          <p className="text-sm text-on-surface">{profile?.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            Cambios guardados correctamente.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="especialidad" className={labelCls}>Especialidad</label>
            <select
              id="especialidad"
              name="especialidad"
              value={form.especialidad}
              onChange={handleChange}
              className={inputCls}
            >
              <option value="">Sin especificar</option>
              {ESPECIALIDADES.map((esp) => (
                <option key={esp} value={esp}>{esp}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="matricula" className={labelCls}>Matrícula profesional</label>
            <input
              id="matricula"
              name="matricula"
              type="text"
              value={form.matricula}
              onChange={handleChange}
              placeholder="MP 12345"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="telefono" className={labelCls}>Teléfono de contacto</label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              value={form.telefono}
              onChange={handleChange}
              placeholder="+54 11 1234-5678"
              className={inputCls}
            />
            <p className="text-[11px] text-on-surface-variant mt-1.5">
              Visible para otros profesionales en interconsultas.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="domicilio" className={labelCls}>Domicilio donde realiza la prestación</label>
          <input
            id="domicilio"
            name="domicilio"
            type="text"
            value={form.domicilio}
            onChange={handleChange}
            placeholder="Av. Corrientes 1234, CABA"
            className={inputCls}
          />
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            Se usa en las planillas de asistencia para obras sociales.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'btn-primary px-6 py-2.5',
              loading && 'opacity-70 cursor-not-allowed'
            )}
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
