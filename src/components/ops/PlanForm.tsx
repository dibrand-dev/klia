'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SYSTEM_FEATURES, CATEGORIAS } from '@/lib/ops/features'
import { cn } from '@/lib/utils'
import type { PlanConFuncionalidades } from '@/types/database'

type Props = {
  plan?: PlanConFuncionalidades
}

export default function PlanForm({ plan }: Props) {
  const router = useRouter()
  const isEditing = !!plan

  const initialFeatures = plan?.plan_funcionalidades.map((f) => f.funcionalidad) ?? []

  const [nombre, setNombre] = useState(plan?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(plan?.descripcion ?? '')
  const [precio, setPrecio] = useState(plan?.precio_mensual?.toString() ?? '0')
  const [esPublico, setEsPublico] = useState(plan?.es_publico ?? true)
  const [esIlimitado, setEsIlimitado] = useState(plan?.es_ilimitado ?? false)
  const [features, setFeatures] = useState<string[]>(initialFeatures)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleFeature(key: string) {
    setFeatures((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    )
  }

  function toggleAll() {
    const all = SYSTEM_FEATURES.map((f) => f.key)
    setFeatures(features.length === all.length ? [] : all)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const planData = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio_mensual: parseFloat(precio) || 0,
      es_publico: esPublico,
      es_ilimitado: esIlimitado,
    }

    let planId = plan?.id

    if (isEditing) {
      const { error: err } = await supabase.from('planes').update(planData).eq('id', plan!.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { data, error: err } = await supabase.from('planes').insert(planData).select('id').single()
      if (err) { setError(err.message); setLoading(false); return }
      planId = data.id
    }

    await supabase.from('plan_funcionalidades').delete().eq('plan_id', planId!)
    if (features.length > 0) {
      const { error: err } = await supabase.from('plan_funcionalidades').insert(
        features.map((f) => ({ plan_id: planId!, funcionalidad: f }))
      )
      if (err) { setError(err.message); setLoading(false); return }
    }

    try {
      await fetch('/api/ops/revalidate-landing', { method: 'POST' })
    } catch (err) {
      console.error('No se pudo revalidar el landing:', err)
      // No bloquea el flujo — el guardado del precio ya se hizo, esto es best-effort
    }

    router.push('/ops/planes')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Datos básicos */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6 space-y-5">
        <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Datos del plan</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Nombre del plan</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Bonificado, Premium, Esencial…"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">Precio mensual (ARS)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-medium">$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="input-field w-full pl-7"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1.5">Descripción <span className="text-on-surface-variant font-normal">(opcional)</span></label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            placeholder="Descripción breve del plan…"
            className="input-field w-full resize-none"
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-4 pt-1">
          <button
            type="button"
            onClick={() => setEsPublico((v) => !v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
              esPublico
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            )}
          >
            <span className="material-symbols-outlined text-base" style={esPublico ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              {esPublico ? 'public' : 'lock'}
            </span>
            {esPublico ? 'Plan público' : 'Plan privado'}
          </button>

          <button
            type="button"
            onClick={() => setEsIlimitado((v) => !v)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
              esIlimitado
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            )}
          >
            <span className="material-symbols-outlined text-base" style={esIlimitado ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              all_inclusive
            </span>
            {esIlimitado ? 'Nunca vence' : 'Vence normalmente'}
          </button>
        </div>

        {esIlimitado && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Las cuentas con este plan no tienen fecha de vencimiento y no se suspenden automáticamente.
          </p>
        )}
        {!esPublico && (
          <p className="text-xs text-on-surface-variant bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-2">
            Este plan no aparece en el sitio público. Solo puede asignarse manualmente desde el panel de administración.
          </p>
        )}
      </div>

      {/* Funcionalidades */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Funcionalidades incluidas</h2>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-primary font-medium hover:underline"
          >
            {features.length === SYSTEM_FEATURES.length ? 'Desmarcar todo' : 'Seleccionar todo'}
          </button>
        </div>

        <div className="space-y-6">
          {CATEGORIAS.map((cat) => {
            const catFeatures = SYSTEM_FEATURES.filter((f) => f.categoria === cat)
            return (
              <div key={cat}>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{cat}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catFeatures.map((feat) => {
                    const checked = features.includes(feat.key)
                    return (
                      <label
                        key={feat.key}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none',
                          checked
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-surface-container-lowest border-outline-variant/20 hover:border-outline-variant/40'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFeature(feat.key)}
                          className="mt-0.5 accent-primary w-4 h-4 shrink-0"
                        />
                        <div>
                          <p className={cn('text-sm font-medium', checked ? 'text-primary' : 'text-on-surface')}>
                            {feat.label}
                          </p>
                          <p className="text-xs text-on-surface-variant mt-0.5">{feat.description}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-on-surface-variant mt-4">
          {features.length} de {SYSTEM_FEATURES.length} funcionalidades seleccionadas
        </p>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/ops/planes')}
          className="btn-secondary px-5 py-2.5"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !nombre.trim()}
          className="btn-primary px-6 py-2.5 disabled:opacity-60"
        >
          {loading ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear plan'}
        </button>
      </div>
    </form>
  )
}
