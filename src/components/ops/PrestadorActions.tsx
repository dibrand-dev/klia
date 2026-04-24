'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types/database'

export default function PrestadorActions({
  profileId,
  profileName,
  planes,
}: {
  profileId: string
  profileName: string
  planes: Pick<Plan, 'id' | 'nombre'>[]
}) {
  const [plan, setPlan] = useState('')
  const [diasPrueba, setDiasPrueba] = useState('')
  const [suspendConfirm, setSuspendConfirm] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function feedback(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 4000)
  }

  async function handleSuspender() {
    if (!suspendConfirm) { setSuspendConfirm(true); return }
    setLoading('suspend')
    feedback('ok', `Acción registrada para ${profileName}. (Integración pendiente)`)
    setSuspendConfirm(false)
    setLoading(null)
  }

  async function handleCambiarPlan() {
    if (!plan) return
    setLoading('plan')
    const nombre = planes.find((p) => p.id === plan)?.nombre ?? plan
    feedback('ok', `Plan cambiado a "${nombre}" para ${profileName}. (Integración pendiente)`)
    setPlan('')
    setLoading(null)
  }

  async function handleExtenderPrueba() {
    if (!diasPrueba || isNaN(Number(diasPrueba))) return
    setLoading('prueba')
    feedback('ok', `Período de prueba extendido ${diasPrueba} días para ${profileName}. (Integración pendiente)`)
    setDiasPrueba('')
    setLoading(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-6">
      <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-5">Acciones de administración</h2>

      {msg && (
        <div className={cn(
          'mb-4 px-4 py-3 rounded-lg text-sm',
          msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        )}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Cambiar plan */}
        <div className="border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-on-surface-variant mb-3 uppercase tracking-wide">Cambiar plan</p>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="input-field mb-3"
          >
            <option value="">Seleccionar plan...</option>
            {planes.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <button
            onClick={handleCambiarPlan}
            disabled={!plan || loading === 'plan'}
            className={cn('btn-primary w-full text-sm py-2', (!plan || loading === 'plan') && 'opacity-50 cursor-not-allowed')}
          >
            {loading === 'plan' ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>

        {/* Extender período de prueba */}
        <div className="border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-on-surface-variant mb-3 uppercase tracking-wide">Extender prueba</p>
          <input
            type="number"
            min="1"
            max="90"
            value={diasPrueba}
            onChange={(e) => setDiasPrueba(e.target.value)}
            placeholder="Días a extender"
            className="input-field mb-3"
          />
          <button
            onClick={handleExtenderPrueba}
            disabled={!diasPrueba || loading === 'prueba'}
            className={cn('btn-primary w-full text-sm py-2', (!diasPrueba || loading === 'prueba') && 'opacity-50 cursor-not-allowed')}
          >
            {loading === 'prueba' ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>

        {/* Suspender / Reactivar */}
        <div className="border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-on-surface-variant mb-3 uppercase tracking-wide">Cuenta</p>
          <p className="text-xs text-on-surface-variant mb-3">
            {suspendConfirm
              ? `¿Confirmás suspender a ${profileName}?`
              : 'Suspendé o reactivá el acceso al sistema.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSuspender}
              disabled={loading === 'suspend'}
              className={cn(
                'flex-1 text-sm py-2 rounded-xl font-semibold transition-colors',
                suspendConfirm
                  ? 'bg-error text-on-error hover:opacity-90'
                  : 'btn-secondary'
              )}
            >
              {suspendConfirm ? 'Sí, suspender' : 'Suspender'}
            </button>
            {suspendConfirm && (
              <button
                onClick={() => setSuspendConfirm(false)}
                className="btn-secondary flex-1 text-sm py-2"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
