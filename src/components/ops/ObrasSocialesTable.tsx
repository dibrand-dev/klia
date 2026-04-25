'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ObraSocial } from '@/types/database'

export default function ObrasSocialesTable({ obras }: { obras: ObraSocial[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [normalizando, setNormalizando] = useState<string | null>(null)
  const [nombreNorm, setNombreNorm] = useState('')

  async function validar(obra: ObraSocial) {
    setLoading(obra.id)
    const supabase = createClient()
    await supabase.from('obras_sociales').update({ validada: true }).eq('id', obra.id)
    router.refresh()
    setLoading(null)
  }

  async function confirmarNormalizacion(obra: ObraSocial) {
    const nombre = nombreNorm.trim()
    if (!nombre) return
    setLoading(obra.id)
    const supabase = createClient()

    // Check if a validated obra social with this name already exists
    const { data: existing } = await supabase
      .from('obras_sociales')
      .select('id, veces_ingresada')
      .ilike('nombre', nombre)
      .eq('validada', true)
      .maybeSingle()

    if (existing) {
      // Merge: add counts into existing, delete this one
      await supabase
        .from('obras_sociales')
        .update({ veces_ingresada: existing.veces_ingresada + obra.veces_ingresada })
        .eq('id', existing.id)
      await supabase.from('obras_sociales').delete().eq('id', obra.id)
    } else {
      // Rename and validate
      await supabase
        .from('obras_sociales')
        .update({ nombre, validada: true })
        .eq('id', obra.id)
    }

    setNormalizando(null)
    setNombreNorm('')
    router.refresh()
    setLoading(null)
  }

  async function descartar(id: string) {
    setLoading(id)
    const supabase = createClient()
    await supabase.from('obras_sociales').delete().eq('id', id)
    router.refresh()
    setLoading(null)
  }

  if (obras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl mb-3 opacity-40">check_circle</span>
        <p className="text-sm font-medium">No hay obras sociales pendientes de validación</p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-outline-variant/20 bg-surface-container-lowest">
          <th className="text-left px-6 py-3 font-semibold text-on-surface-variant">Nombre ingresado</th>
          <th className="text-left px-6 py-3 font-semibold text-on-surface-variant">Plan</th>
          <th className="text-left px-4 py-3 font-semibold text-on-surface-variant">Veces ingresada</th>
          <th className="px-6 py-3" />
        </tr>
      </thead>
      <tbody>
        {obras.map((obra) => (
          <tr key={obra.id} className="border-b border-outline-variant/10 last:border-0">
            <td className="px-6 py-4 font-medium text-on-surface">{obra.nombre}</td>
            <td className="px-6 py-4 text-on-surface-variant">{obra.plan || '—'}</td>
            <td className="px-4 py-4 text-on-surface-variant">{obra.veces_ingresada}</td>
            <td className="px-6 py-4">
              {normalizando === obra.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nombreNorm}
                    onChange={(e) => setNombreNorm(e.target.value)}
                    placeholder="Nombre correcto..."
                    className="input-field text-sm w-48"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmarNormalizacion(obra)
                      if (e.key === 'Escape') { setNormalizando(null); setNombreNorm('') }
                    }}
                  />
                  <button
                    onClick={() => confirmarNormalizacion(obra)}
                    disabled={!nombreNorm.trim() || loading === obra.id}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { setNormalizando(null); setNombreNorm('') }}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => validar(obra)}
                    disabled={loading === obra.id}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Validar
                  </button>
                  <button
                    onClick={() => { setNormalizando(obra.id); setNombreNorm(obra.nombre) }}
                    disabled={loading === obra.id}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Normalizar
                  </button>
                  <button
                    onClick={() => descartar(obra.id)}
                    disabled={loading === obra.id}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Descartar
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
