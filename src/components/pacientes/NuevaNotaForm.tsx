'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import RichTextEditor from '@/components/ui/RichTextEditor'

function isHtmlEmpty(html: string): boolean {
  return !html.replace(/<[^>]*>/g, '').trim()
}

interface Props {
  pacienteId: string
  turnoId?: string
  onCreada?: () => void
  onClose?: () => void
}

export default function NuevaNotaForm({ pacienteId, turnoId, onCreada, onClose }: Props) {
  const [contenido, setContenido] = useState('')
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGuardar() {
    if (isHtmlEmpty(contenido)) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: dbError } = await supabase.from('notas_clinicas').insert({
      terapeuta_id: user.id,
      paciente_id: pacienteId,
      turno_id: turnoId ?? null,
      fecha,
      contenido,
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
        <RichTextEditor
          value={contenido}
          onChange={setContenido}
          placeholder="¿Qué trabajaron en esta sesión? Temas tratados, evolución, próximos pasos..."
          minHeight="220px"
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
          disabled={loading || isHtmlEmpty(contenido)}
          className={cn('btn-primary flex-1 py-3', (loading || isHtmlEmpty(contenido)) && 'opacity-50')}
        >
          {loading ? 'Guardando...' : 'Guardar nota'}
        </button>
      </div>
    </div>
  )
}
