'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Configuracion } from '@/types/database'

const LABELS: Record<string, { label: string; type: 'number' | 'text'; prefix?: string }> = {
  dias_prueba:               { label: 'Días de período de prueba', type: 'number' },
  precio_esencial_mensual:   { label: 'Precio plan Esencial mensual', type: 'number', prefix: 'ARS' },
  precio_profesional_mensual:{ label: 'Precio plan Profesional mensual', type: 'number', prefix: 'ARS' },
  precio_premium_mensual:    { label: 'Precio plan Premium mensual', type: 'number', prefix: 'ARS' },
}

export default function ConfiguracionForm({ configs }: { configs: Configuracion[] }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(configs.map((c) => [c.clave, c.valor]))
  )
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const supabase = createClient()

    const updates = Object.entries(values).map(([clave, valor]) =>
      supabase.from('configuracion').update({ valor, updated_at: new Date().toISOString() }).eq('clave', clave)
    )

    const results = await Promise.all(updates)
    const firstError = results.find((r) => r.error)

    if (firstError?.error) {
      setError('Error al guardar los cambios. Intentá de nuevo.')
      setLoading(false)
      return
    }

    setSaved(true)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6">
      <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-6">Parámetros del sistema</h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {saved && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          Cambios guardados correctamente.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {configs.map((config) => {
          const meta = LABELS[config.clave]
          if (!meta) return null
          return (
            <div key={config.clave}>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-2">
                {meta.label}
              </label>
              {config.descripcion && (
                <p className="text-xs text-on-surface-variant mb-2">{config.descripcion}</p>
              )}
              <div className="relative">
                {meta.prefix && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-medium pointer-events-none">
                    {meta.prefix}
                  </span>
                )}
                <input
                  type={meta.type}
                  min={meta.type === 'number' ? 0 : undefined}
                  value={values[config.clave] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [config.clave]: e.target.value }))}
                  className={cn(
                    'w-full bg-surface-container-high border border-outline-variant/15 text-on-surface rounded-lg px-4 py-3 text-sm focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none',
                    meta.prefix && 'pl-12'
                  )}
                />
              </div>
            </div>
          )
        })}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className={cn('btn-primary px-6 py-2.5', loading && 'opacity-70 cursor-not-allowed')}
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
