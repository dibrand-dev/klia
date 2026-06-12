'use client'

import { useState, useEffect, useCallback } from 'react'

type Feature = {
  id: string
  plan_id: string
  texto: string
  incluido: boolean
  orden: number
  activo: boolean
}

export default function PlanFeaturesEditor({ planId, planNombre }: { planId: string; planNombre: string }) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [newTexto, setNewTexto] = useState('')
  const [newIncluido, setNewIncluido] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ops/planes/features?plan_id=${planId}`)
      const data = await res.json() as Feature[]
      setFeatures(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => { load() }, [load])

  async function handleToggleIncluido(f: Feature) {
    setSaving(f.id)
    setFeatures(prev => prev.map(x => x.id === f.id ? { ...x, incluido: !x.incluido } : x))
    await fetch('/api/ops/planes/features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, incluido: !f.incluido }),
    })
    setSaving(null)
  }

  async function handleTextChange(f: Feature, texto: string) {
    setFeatures(prev => prev.map(x => x.id === f.id ? { ...x, texto } : x))
  }

  async function handleTextBlur(f: Feature) {
    if (f.texto.trim() === '') return
    setSaving(f.id)
    await fetch('/api/ops/planes/features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, texto: f.texto }),
    })
    setSaving(null)
  }

  async function handleMove(f: Feature, direction: 'up' | 'down') {
    const idx = features.findIndex(x => x.id === f.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= features.length) return

    const newFeatures = [...features]
    const swap = newFeatures[swapIdx]
    newFeatures[swapIdx] = { ...newFeatures[idx], orden: swap.orden }
    newFeatures[idx] = { ...swap, orden: newFeatures[swapIdx].orden }
    // re-assign sequential orden
    const reordered = direction === 'up'
      ? [...newFeatures.slice(0, idx), newFeatures[swapIdx], newFeatures[idx], ...newFeatures.slice(idx + 1)]
      : [...newFeatures.slice(0, swapIdx), newFeatures[swapIdx], newFeatures[idx], ...newFeatures.slice(swapIdx + 1)]

    const final = reordered.map((x, i) => ({ ...x, orden: i + 1 }))
    setFeatures(final)

    setSaving(f.id)
    await Promise.all(
      final.map(x =>
        fetch('/api/ops/planes/features', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: x.id, orden: x.orden }),
        })
      )
    )
    setSaving(null)
  }

  async function handleDelete(id: string) {
    setFeatures(prev => prev.filter(x => x.id !== id))
    await fetch(`/api/ops/planes/features?id=${id}`, { method: 'DELETE' })
  }

  async function handleAdd() {
    if (!newTexto.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch('/api/ops/planes/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          texto: newTexto.trim(),
          incluido: newIncluido,
          orden: features.length + 1,
        }),
      })
      const data = await res.json() as Feature
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? 'Error')
      setFeatures(prev => [...prev, data])
      setNewTexto('')
      setNewIncluido(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-on-surface">Features de marketing — Plan {planNombre}</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">Lista visible en /planes y /cuenta-bloqueada</p>
        </div>
        <span className="text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full">
          {features.length} ítems
        </span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-on-surface-variant">Cargando…</div>
      ) : (
        <div className="divide-y divide-outline-variant/10">
          {features.length === 0 && (
            <p className="px-6 py-5 text-sm text-on-surface-variant italic">Sin features cargadas aún.</p>
          )}
          {features.map((f, idx) => (
            <div key={f.id} className="px-4 py-3 flex items-center gap-3">
              {/* orden arrows */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => handleMove(f, 'up')}
                  disabled={idx === 0 || saving === f.id}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container disabled:opacity-30 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm leading-none">expand_less</span>
                </button>
                <button
                  onClick={() => handleMove(f, 'down')}
                  disabled={idx === features.length - 1 || saving === f.id}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container disabled:opacity-30 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm leading-none">expand_more</span>
                </button>
              </div>

              {/* incluido toggle */}
              <button
                onClick={() => handleToggleIncluido(f)}
                disabled={saving === f.id}
                className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all disabled:opacity-50"
                style={{
                  borderColor: f.incluido ? '#4F46E5' : '#D1D5DB',
                  background: f.incluido ? '#4F46E5' : 'transparent',
                }}
                title={f.incluido ? 'Incluido' : 'No incluido'}
              >
                {f.incluido && (
                  <svg viewBox="0 0 24 24" width="10" height="10" stroke="white" strokeWidth="3" fill="none">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>

              {/* texto */}
              <input
                value={f.texto}
                onChange={e => handleTextChange(f, e.target.value)}
                onBlur={() => handleTextBlur(f)}
                className={`flex-1 min-w-0 text-sm border-0 bg-transparent outline-none focus:bg-surface-container/50 rounded px-1 py-0.5 transition-colors ${!f.incluido ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}
              />

              {saving === f.id && (
                <span className="text-xs text-on-surface-variant shrink-0">guardando…</span>
              )}

              {/* delete */}
              <button
                onClick={() => handleDelete(f.id)}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Eliminar"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      <div className="px-4 py-3 border-t border-outline-variant/10 bg-surface-container/30 flex items-center gap-3">
        <div className="w-5 shrink-0" />

        <button
          onClick={() => setNewIncluido(v => !v)}
          className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
          style={{
            borderColor: newIncluido ? '#4F46E5' : '#D1D5DB',
            background: newIncluido ? '#4F46E5' : 'transparent',
          }}
          title={newIncluido ? 'Incluido' : 'No incluido'}
        >
          {newIncluido && (
            <svg viewBox="0 0 24 24" width="10" height="10" stroke="white" strokeWidth="3" fill="none">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </button>

        <input
          value={newTexto}
          onChange={e => setNewTexto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Nueva feature…"
          className="flex-1 min-w-0 text-sm border border-outline-variant/30 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant"
        />

        <button
          onClick={handleAdd}
          disabled={!newTexto.trim() || adding}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {adding ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <span className="material-symbols-outlined text-base leading-none">add</span>
          )}
          Agregar
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
          {error}
        </div>
      )}
    </div>
  )
}
