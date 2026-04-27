'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types/database'

export default function PrestadorActions({
  profileId,
  profileName,
  estadoCuenta,
  trialFin,
  planes,
}: {
  profileId: string
  profileName: string
  estadoCuenta: string
  trialFin: string | null
  planes: Pick<Plan, 'id' | 'nombre'>[]
}) {
  const router = useRouter()
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
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ estado_cuenta: 'bloqueada' })
      .eq('id', profileId)
    if (error) { feedback('err', error.message); setLoading(null); return }
    setSuspendConfirm(false)
    setLoading(null)
    feedback('ok', `${profileName} suspendido correctamente`)
    router.refresh()
  }

  async function handleCambiarPlan() {
    if (!plan) return
    setLoading('plan')
    const supabase = createClient()
    const planNombre = planes.find((p) => p.id === plan)?.nombre?.toLowerCase() ?? ''
    const updates: Record<string, unknown> = { plan: planNombre }
    if (estadoCuenta === 'trial') updates.estado_cuenta = 'activa'
    const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)
    if (error) { feedback('err', error.message); setLoading(null); return }
    setPlan('')
    setLoading(null)
    feedback('ok', `Plan cambiado a "${planNombre}"`)
    router.refresh()
  }

  async function handleExtenderPrueba() {
    const dias = Number(diasPrueba)
    if (!dias || isNaN(dias)) return
    setLoading('prueba')
    const supabase = createClient()
    const base = trialFin && new Date(trialFin) > new Date() ? new Date(trialFin) : new Date()
    base.setDate(base.getDate() + dias)
    const { error } = await supabase
      .from('profiles')
      .update({ trial_fin: base.toISOString(), estado_cuenta: 'trial' })
      .eq('id', profileId)
    if (error) { feedback('err', error.message); setLoading(null); return }
    setDiasPrueba('')
    setLoading(null)
    feedback('ok', `Período de prueba extendido ${dias} días`)
    router.refresh()
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
