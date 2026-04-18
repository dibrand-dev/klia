'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { NotaClinica } from '@/types/database'

export default function NotaDetalleEditor({ nota, pacienteId }: { nota: NotaClinica; pacienteId: string }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [contenido, setContenido] = useState(nota.contenido)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fechaStr = format(parseISO(nota.fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  const horaStr = format(parseISO(nota.created_at), 'HH:mm')

  async function handleGuardar() {
    if (!contenido.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('notas_clinicas')
      .update({ contenido: contenido.trim() })
      .eq('id', nota.id)
    if (dbError) { setError('Error al guardar. Intentá de nuevo.'); setLoading(false); return }
    setEditando(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="card p-4 space-y-4">
      <p className="text-xs text-gray-500 capitalize font-medium">
        {fechaStr} — {horaStr}hs
      </p>

      {editando ? (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={12}
            className="input-field resize-none"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={() => { setContenido(nota.contenido); setEditando(false) }}
              className="btn-secondary flex-1 py-3"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={loading || !contenido.trim()}
              className={cn('btn-primary flex-1 py-3', (loading || !contenido.trim()) && 'opacity-50')}
            >
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{contenido}</p>
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar nota
          </button>
        </>
      )}
    </div>
  )
}
