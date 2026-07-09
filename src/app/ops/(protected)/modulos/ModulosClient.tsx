'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ModuloConfig } from '@/types/database'

const PLANES = ['esencial', 'profesional', 'premium', 'bonificado'] as const
type Plan = typeof PLANES[number]

const PLAN_LABEL: Record<Plan, string> = {
  esencial: 'Esencial',
  profesional: 'Profesional',
  premium: 'Premium',
  bonificado: 'Bonificado',
}

const PLAN_COLOR: Record<Plan, string> = {
  esencial:     'bg-blue-50 text-blue-700 border-blue-200',
  profesional:  'bg-violet-50 text-violet-700 border-violet-200',
  premium:      'bg-amber-50 text-amber-700 border-amber-200',
  bonificado:   'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function ModulosClient({ modulos: initial }: { modulos: ModuloConfig[] }) {
  const router = useRouter()
  const [modulos, setModulos] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean } | null>(null)

  async function togglePlan(moduloId: string, plan: Plan, current: string[]) {
    const nuevos = current.includes(plan)
      ? current.filter(p => p !== plan)
      : [...current, plan]

    setSaving(`${moduloId}-${plan}`)
    setFeedback(null)

    const res = await fetch('/api/ops/modulos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modulo_id: moduloId, planes: nuevos }),
    })

    if (res.ok) {
      setModulos(prev => prev.map(m =>
        m.modulo_id === moduloId ? { ...m, planes: nuevos } : m
      ))
      setFeedback({ id: moduloId, ok: true })
    } else {
      setFeedback({ id: moduloId, ok: false })
    }
    setSaving(null)
    setTimeout(() => setFeedback(null), 2500)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_repeat(4,88px)] gap-3 px-5 pb-1">
        <div />
        {PLANES.map(p => (
          <div key={p} className={`text-center text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg border ${PLAN_COLOR[p]}`}>
            {PLAN_LABEL[p]}
          </div>
        ))}
      </div>

      {/* Module rows */}
      {modulos.map(modulo => (
        <div
          key={modulo.modulo_id}
          className="bg-white border border-outline-variant/20 rounded-xl px-5 py-4 shadow-sm"
        >
          <div className="grid grid-cols-[1fr_repeat(4,88px)] gap-3 items-center">
            {/* Module info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-surface-container-high grid place-items-center flex-none">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  {modulo.icono}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-on-surface text-sm">{modulo.nombre}</p>
                {modulo.descripcion && (
                  <p className="text-xs text-on-surface-variant truncate">{modulo.descripcion}</p>
                )}
              </div>
            </div>

            {/* Plan toggles */}
            {PLANES.map(plan => {
              const enabled = modulo.planes.includes(plan)
              const isSaving = saving === `${modulo.modulo_id}-${plan}`
              return (
                <div key={plan} className="flex justify-center">
                  <button
                    onClick={() => togglePlan(modulo.modulo_id, plan, modulo.planes)}
                    disabled={!!saving}
                    title={enabled ? `Quitar acceso ${PLAN_LABEL[plan]}` : `Dar acceso ${PLAN_LABEL[plan]}`}
                    className={`w-10 h-6 rounded-full transition-all duration-200 relative flex-none ${
                      enabled
                        ? 'bg-primary'
                        : 'bg-gray-200'
                    } ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {isSaving ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </span>
                    ) : (
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                          enabled ? 'left-[18px]' : 'left-0.5'
                        }`}
                      />
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Feedback */}
          {feedback?.id === modulo.modulo_id && (
            <div className={`mt-2 text-xs flex items-center gap-1.5 ${feedback.ok ? 'text-green-600' : 'text-red-600'}`}>
              <span className="material-symbols-outlined text-[13px]">
                {feedback.ok ? 'check_circle' : 'error'}
              </span>
              {feedback.ok ? 'Guardado correctamente' : 'Error al guardar'}
            </div>
          )}
        </div>
      ))}

      <p className="text-xs text-on-surface-variant/60 pt-2 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[13px]">info</span>
        Los cambios se aplican de inmediato. El sidebar del profesional se actualiza en la próxima carga de página.
      </p>
    </div>
  )
}
