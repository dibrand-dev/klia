'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Props {
  pacienteId: string
  onCreada?: () => void
  onClose?: () => void
}

export default function NuevaNotaForm({ pacienteId, onCreada, onClose }: Props) {
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
    if (!user) return

    const { error: dbError } = await supabase.from('notas_clinicas').insert({
      terapeuta_id: user.id,
      paciente_id: pacienteId,
      turno_id: null,
      fecha,
      contenido: contenido.trim(),
    })

    if (dbError) { setError('Error al guardar la nota. Intentá de nuevo.'); setLoading(false); return }

    onCreada?.()
  }

  return (
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
        <button
          onClick={onClose}
          className="btn-secondary flex-1 py-3 text-sm font-semibold"
        >
          Cancelar
        </button>
        <button
          onClick={handleGuardar}
          disabled={loading || !contenido.trim()}
          className={cn('btn-primary flex-1 py-3', (loading || !contenido.trim()) && 'opacity-50')}
        >
          {loading ? 'Guardando...' : 'Guardar nota'}
        </button>
      </div>
    </div>
  )
}
