'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ProfileWithLastSignIn } from '@/types/database'
import SlideOver from '@/components/ui/SlideOver'

type EstadoCuenta = 'trial' | 'activa' | 'bloqueada' | 'cancelada'
type Plan = 'esencial' | 'profesional' | 'premium' | 'bonificado'
type Row = ProfileWithLastSignIn

// ─── Badges ────────────────────────────────────────────────────────────────

function EstadoBadge({ row }: { row: Row }) {
  if (!row.email_confirmed_at) {
    return <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">Email pendiente</span>
  }
  switch (row.estado_cuenta) {
    case 'trial': {
      const dias = differenceInDays(new Date(row.trial_fin), new Date())
      return (
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${dias <= 5 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
          Trial · {Math.max(0, dias)}d
        </span>
      )
    }
    case 'activa':
      return <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">Activa</span>
    case 'bloqueada':
      return <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-semibold">Bloqueada</span>
    case 'cancelada':
      return <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-semibold">Cancelada</span>
    default:
      return null
  }
}

function PlanBadge({ plan }: { plan: Plan }) {
  const styles: Record<Plan, string> = {
    esencial: 'bg-surface-container text-on-surface-variant',
    profesional: 'bg-blue-50 text-blue-700',
    premium: 'bg-purple-50 text-purple-700',
    bonificado: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${styles[plan] ?? 'bg-gray-100 text-gray-600'}`}>
      {plan}
    </span>
  )
}

// ─── Row Menu ───────────────────────────────────────────────────────────────

function RowMenu({ id, onSuscripcion, onDelete }: {
  id: string
  onSuscripcion: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Opciones"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 min-w-[180px] z-10 py-1">
          <Link
            href={`/ops/prestadores/${id}`}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            Editar perfil
          </Link>
          <button
            onClick={() => { setOpen(false); onSuscripcion() }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Gestionar suscripción
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Subscription Panel ─────────────────────────────────────────────────────

function SuscripcionPanel({ prestador, onClose, onSaved }: {
  prestador: Row | null
  onClose: () => void
  onSaved: (updated: Partial<Row>) => void
}) {
  const [estado, setEstado] = useState<EstadoCuenta>('trial')
  const [plan, setPlan] = useState<Plan>('premium')
  const [trialFin, setTrialFin] = useState('')
  const [suscripcionFin, setSuscripcionFin] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (prestador) {
      setEstado(prestador.estado_cuenta)
      setPlan(prestador.plan)
      setTrialFin(prestador.trial_fin ? prestador.trial_fin.slice(0, 10) : '')
      setSuscripcionFin(prestador.suscripcion_fin ? prestador.suscripcion_fin.slice(0, 10) : '')
    }
  }, [prestador])

  async function handleGuardar() {
    if (!prestador) return
    setLoading(true)
    const supabase = createClient()
    const updates: Record<string, unknown> = {
      plan,
      estado_cuenta: estado,
      trial_fin: trialFin ? new Date(trialFin).toISOString() : null,
      suscripcion_fin: suscripcionFin ? new Date(suscripcionFin).toISOString() : null,
    }
    if (plan === 'bonificado') {
      updates.trial_inicio = null
      updates.trial_fin = null
    }
    await supabase.from('profiles').update(updates).eq('id', prestador.id)
    onSaved({
      plan,
      estado_cuenta: estado,
      trial_fin: trialFin ? new Date(trialFin).toISOString() : prestador.trial_fin,
      suscripcion_fin: suscripcionFin ? new Date(suscripcionFin).toISOString() : null,
    })
    setLoading(false)
    onClose()
  }

  const labelCls = 'block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5'
  const selectCls = 'w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors'
  const inputCls = 'w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors'

  return (
    <SlideOver
      open={prestador !== null}
      onClose={onClose}
      title="Gestionar suscripción"
      subtitle={prestador ? `${prestador.nombre} ${prestador.apellido}` : undefined}
      width="sm"
    >
      {prestador && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Estado de cuenta</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoCuenta)} className={selectCls}>
              <option value="trial">Trial</option>
              <option value="activa">Activa</option>
              <option value="bloqueada">Bloqueada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Plan</label>
            <select
              value={plan}
              onChange={(e) => {
                const p = e.target.value as Plan
                setPlan(p)
                if (p === 'bonificado') {
                  setEstado('activa')
                  setTrialFin('')
                  setSuscripcionFin('')
                }
              }}
              className={selectCls}
            >
              <option value="esencial">Esencial</option>
              <option value="profesional">Profesional</option>
              <option value="premium">Premium</option>
              <option value="bonificado">Bonificado</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Fin del trial</label>
            <input type="date" value={trialFin} onChange={(e) => setTrialFin(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Fin de suscripción</label>
            <input type="date" value={suscripcionFin} onChange={(e) => setSuscripcionFin(e.target.value)} className={inputCls} />
            <p className="text-[11px] text-on-surface-variant mt-1">Dejar vacío si no aplica</p>
          </div>

          {/* Acciones rápidas */}
          <div className="border-t border-outline-variant/20 pt-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-2">Acciones rápidas</p>
            <button
              onClick={() => {
                setEstado('activa')
                const fin = new Date()
                fin.setFullYear(fin.getFullYear() + 1)
                setSuscripcionFin(fin.toISOString().slice(0, 10))
              }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium"
            >
              ✓ Activar por 1 año
            </button>
            <button
              onClick={() => setEstado('bloqueada')}
              className="w-full text-left text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium"
            >
              ✗ Bloquear cuenta
            </button>
            <button
              onClick={() => {
                setEstado('trial')
                const fin = new Date()
                fin.setDate(fin.getDate() + 21)
                setTrialFin(fin.toISOString().slice(0, 10))
              }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors font-medium"
            >
              ↺ Renovar trial 21 días
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={loading} className="btn-secondary flex-1 py-2.5">
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={loading}
              className="btn-primary flex-1 py-2.5 disabled:opacity-70"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </SlideOver>
  )
}

// ─── Delete Panel ───────────────────────────────────────────────────────────

function DeletePanel({ prestador, loading, onCancel, onConfirm }: {
  prestador: Row | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <SlideOver open={prestador !== null} onClose={onCancel} title="Eliminar prestador" width="sm">
      {prestador && (
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Estás a punto de eliminar a{' '}
            <span className="font-semibold text-on-surface">{prestador.nombre} {prestador.apellido}</span>{' '}
            y TODA su información:
          </p>
          <ul className="text-sm text-on-surface-variant space-y-1">
            {['Pacientes', 'Turnos', 'Historial clínico', 'Notas de sesión', 'Datos de facturación'].map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
          <p className="text-sm font-semibold text-red-600">Esta acción no se puede deshacer.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={onCancel} disabled={loading} className="btn-secondary flex-1 py-2.5">Cancelar</button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-70"
            >
              {loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      )}
    </SlideOver>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${type === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
      {msg}
    </div>
  )
}

// ─── Main Table ─────────────────────────────────────────────────────────────

export default function PrestadoresTable({ prestadores }: { prestadores: ProfileWithLastSignIn[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(prestadores)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [suscripcionTarget, setSuscripcionTarget] = useState<Row | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const id = deleteTarget.id

    await supabase.from('notas_clinicas').delete().eq('terapeuta_id', id)
    await supabase.from('turnos').delete().eq('terapeuta_id', id)
    await supabase.from('pacientes').delete().eq('terapeuta_id', id)
    await supabase.from('profiles').delete().eq('id', id)

    const res = await fetch(`/api/ops/prestadores/${id}`, { method: 'DELETE' })
    const name = `${deleteTarget.nombre} ${deleteTarget.apellido}`

    if (!res.ok) {
      const { error } = await res.json()
      setDeleting(false)
      showToast(`Error al eliminar usuario: ${error}`, 'error')
      return
    }

    setRows((prev) => prev.filter((r) => r.id !== id))
    setDeleteTarget(null)
    setDeleting(false)
    showToast(`${name} eliminado correctamente`)
  }

  function handleSuscripcionSaved(id: string, updated: Partial<Row>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...updated } : r))
    showToast('Suscripción actualizada')
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <SuscripcionPanel
        prestador={suscripcionTarget}
        onClose={() => setSuscripcionTarget(null)}
        onSaved={(updated) => {
          if (suscripcionTarget) handleSuscripcionSaved(suscripcionTarget.id, updated)
          setSuscripcionTarget(null)
        }}
      />

      <DeletePanel
        prestador={deleteTarget}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/10 bg-surface-container-lowest">
              <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Profesional</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Especialidad</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Plan</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Estado</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Registro</th>
              <th className="text-left px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant">Último acceso</th>
              <th className="px-6 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-outline-variant/5 hover:bg-surface-container-lowest transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/ops/prestadores/${p.id}`} className="font-medium text-primary-600 hover:underline block">
                    {p.nombre} {p.apellido}
                  </Link>
                  <span className="text-xs text-gray-500 block">{p.email}</span>
                </td>
                <td className="px-6 py-4 text-on-surface-variant">{p.especialidad ?? '—'}</td>
                <td className="px-6 py-4">
                  <PlanBadge plan={p.plan} />
                </td>
                <td className="px-6 py-4">
                  <EstadoBadge row={p} />
                </td>
                <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                  {format(parseISO(p.created_at), 'd MMM yyyy', { locale: es })}
                </td>
                <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                  {p.last_sign_in_at ? format(parseISO(p.last_sign_in_at), 'dd/MM/yy HH:mm') : '—'}
                </td>
                <td className="px-6 py-4">
                  <RowMenu
                    id={p.id}
                    onSuscripcion={() => setSuscripcionTarget(p)}
                    onDelete={() => setDeleteTarget(p)}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl opacity-20 mb-3 block">search_off</span>
                  <p>No se encontraron prestadores.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
