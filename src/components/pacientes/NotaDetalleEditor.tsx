'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { NotaClinica } from '@/types/database'

function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[completar\]/g, '')
    .trim()
}

export default function NotaDetalleEditor({ nota, pacienteId, onSaved, onDeleted }: { nota: NotaClinica; pacienteId: string; onSaved?: () => void; onDeleted?: () => void }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [contenido, setContenido] = useState(nota.contenido)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fechaStr = format(parseISO(nota.fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  const horaStr = format(parseISO(nota.created_at), 'HH:mm')

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('notas_clinicas').delete().eq('id', nota.id)
    if (dbError) { setDeleting(false); setConfirmDelete(false); return }
    setDeleting(false)
    onDeleted?.()
  }

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
    onSaved?.()
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
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{limpiarMarkdown(contenido)}</p>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar nota
            </button>

            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">¿Eliminar nota?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting ? '...' : 'Confirmar'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-sm text-red-300 hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
