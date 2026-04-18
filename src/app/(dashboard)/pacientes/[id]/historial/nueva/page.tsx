'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function NuevaNotaPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [contenido, setContenido] = useState('')
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGuardar() {
    if (!contenido.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: dbError } = await supabase.from('notas_clinicas').insert({
      terapeuta_id: user.id,
      paciente_id: params.id,
      turno_id: null,
      fecha,
      contenido: contenido.trim(),
    })

    if (dbError) { setError('Error al guardar la nota. Intentá de nuevo.'); setLoading(false); return }

    router.push(`/pacientes/${params.id}/historial`)
    router.refresh()
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href={`/pacientes/${params.id}/historial`}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Nueva nota</h1>
          <p className="text-sm text-gray-500">Nota de sesión o anotación clínica</p>
        </div>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="input-field"
          />
        </div>

        <div className="card p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota de sesión</label>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={10}
            placeholder="¿Qué trabajaron en esta sesión? Temas tratados, evolución, próximos pasos..."
            className="input-field resize-none"
            autoFocus
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Link
            href={`/pacientes/${params.id}/historial`}
            className="btn-secondary flex-1 py-3 text-center text-sm font-semibold"
          >
            Cancelar
          </Link>
          <button
            onClick={handleGuardar}
            disabled={loading || !contenido.trim()}
            className={cn('btn-primary flex-1 py-3', (loading || !contenido.trim()) && 'opacity-50')}
          >
            {loading ? 'Guardando...' : 'Guardar nota'}
          </button>
        </div>
      </div>
    </div>
  )
}
