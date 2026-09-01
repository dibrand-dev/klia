'use client'

import { useState, useEffect } from 'react'

type Colaboradora = {
  id: string
  email: string | null
  nombre: string | null
  apellido: string | null
  activo: boolean
  invitacion_aceptada: boolean
  invitado_en: string
  aceptado_en: string | null
}

const inputCls = 'w-full bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors'
const labelCls = 'block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5'

function nombreCompleto(c: Colaboradora): string {
  const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ')
  return nombre || c.email || 'Sin nombre'
}

function EstadoBadge({ c }: { c: Colaboradora }) {
  if (!c.activo) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-400">Desactivada</span>
  }
  if (c.invitacion_aceptada) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-50 text-green-700">Activa</span>
  }
  return <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700">Invitación pendiente</span>
}

export default function ColaboradorasConfig() {
  const [list, setList] = useState<Colaboradora[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  async function cargarLista() {
    setLoading(true)
    try {
      const res = await fetch('/api/colaboradores')
      const data = await res.json() as { colaboradores?: Colaboradora[] }
      setList(data.colaboradores ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarLista()
  }, [])

  async function handleInvitar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('El email es obligatorio'); return }
    setInviting(true)
    setError(null)

    const res = await fetch('/api/colaboradores/invitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), nombre: nombre.trim() || undefined }),
    })
    const resultado = await res.json() as { error?: string; message?: string }

    if (!res.ok) {
      setError(resultado.message ?? resultado.error ?? 'Error al invitar')
      setInviting(false)
      return
    }

    setNombre('')
    setEmail('')
    setInviting(false)
    await cargarLista()
  }

  async function handleReenviar(c: Colaboradora) {
    setActionLoadingId(c.id)
    setError(null)
    const res = await fetch(`/api/colaboradores/${c.id}/reenviar`, { method: 'POST' })
    const resultado = await res.json() as { error?: string; message?: string }
    if (!res.ok) {
      setError(resultado.message ?? resultado.error ?? 'Error al reenviar la invitación')
      setActionLoadingId(null)
      return
    }
    setActionLoadingId(null)
    await cargarLista()
  }

  async function handleDesactivar(c: Colaboradora) {
    if (!window.confirm(`¿Desactivar el acceso de ${nombreCompleto(c)}?`)) return
    setActionLoadingId(c.id)
    setError(null)
    const res = await fetch(`/api/colaboradores/${c.id}/desactivar`, { method: 'PATCH' })
    const resultado = await res.json() as { error?: string; message?: string }
    if (!res.ok) {
      setError(resultado.message ?? resultado.error ?? 'Error al desactivar')
      setActionLoadingId(null)
      return
    }
    setActionLoadingId(null)
    await cargarLista()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Invitar colaboradora</p>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={handleInvitar} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className={labelCls}>Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="María" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email <span className="text-red-500">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@ejemplo.com" className={inputCls} />
          </div>
          <button type="submit" disabled={inviting} className="btn-primary py-2.5 px-5 disabled:opacity-70 whitespace-nowrap">
            {inviting ? 'Invitando...' : 'Invitar'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-14 text-center text-on-surface-variant">
          <p className="text-sm">Cargando...</p>
        </div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-14 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl opacity-20 mb-3 block">group</span>
          <p className="text-sm">Todavía no invitaste a ninguna colaboradora.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-on-surface">{nombreCompleto(c)}</p>
                  <EstadoBadge c={c} />
                </div>
                {c.email && <p className="text-xs text-on-surface-variant mt-0.5">{c.email}</p>}
              </div>
              {c.activo && !c.invitacion_aceptada && (
                <button
                  onClick={() => handleReenviar(c)}
                  disabled={actionLoadingId === c.id}
                  className="text-xs text-primary hover:underline font-medium px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {actionLoadingId === c.id ? 'Reenviando...' : 'Reenviar invitación'}
                </button>
              )}
              {c.activo && c.invitacion_aceptada && (
                <button
                  onClick={() => handleDesactivar(c)}
                  disabled={actionLoadingId === c.id}
                  className="text-xs text-red-600 hover:underline font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {actionLoadingId === c.id ? 'Desactivando...' : 'Desactivar acceso'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
