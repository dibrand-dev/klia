'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SlideOver from '@/components/ui/SlideOver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import TestimonioAvatarUploader from './TestimonioAvatarUploader'
import { cn } from '@/lib/utils'
import type { Testimonio } from '@/types/database'

interface Props {
  testimoniosIniciales: Testimonio[]
}

function Avatar({ testimonio, size = 40 }: { testimonio: Testimonio; size?: number }) {
  if (testimonio.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={testimonio.avatar_url}
        alt={testimonio.nombre}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: testimonio.color_bg ?? '#8A93A1',
        color: 'white', fontWeight: 700, fontSize: size * 0.38,
      }}
    >
      {testimonio.iniciales ?? '—'}
    </div>
  )
}

function TestimonioForm({ testimonio, open, onClose, onSaved }: {
  testimonio: Testimonio | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!testimonio
  const [quote, setQuote] = useState(testimonio?.quote ?? '')
  const [nombre, setNombre] = useState(testimonio?.nombre ?? '')
  const [rol, setRol] = useState(testimonio?.rol ?? '')
  const [orden, setOrden] = useState(testimonio?.orden?.toString() ?? '0')
  const [activo, setActivo] = useState(testimonio?.activo ?? true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(testimonio?.avatar_url ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quote.trim() || !nombre.trim() || !rol.trim()) return
    setLoading(true)
    setError(null)

    const body = {
      quote: quote.trim(),
      nombre: nombre.trim(),
      rol: rol.trim(),
      avatar_url: avatarUrl,
      orden: Number(orden) || 0,
      activo,
    }

    const url = isEditing ? `/api/ops/testimonios/${testimonio!.id}` : '/api/ops/testimonios'
    const method = isEditing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
    onSaved()
  }

  return (
    <SlideOver open={open} onClose={onClose} title={testimonio ? 'Editar testimonio' : 'Nuevo testimonio'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Testimonio <span className="text-error">*</span>
          </label>
          <textarea value={quote} onChange={(e) => setQuote(e.target.value)} required rows={4} className="input-field w-full resize-none" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Nombre <span className="text-error">*</span>
          </label>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">
            Rol / especialidad <span className="text-error">*</span>
          </label>
          <input type="text" value={rol} onChange={(e) => setRol(e.target.value)} required className="input-field" placeholder="Ej: Psicóloga, Nutricionista" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Orden</label>
          <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} className="input-field" />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant mb-1.5">Avatar</label>
          <TestimonioAvatarUploader
            avatarUrl={avatarUrl}
            onUpload={(url) => setAvatarUrl(url)}
            onRemove={() => setAvatarUrl(null)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Testimonio activo (visible en la landing)
        </label>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancelar</button>
          <button
            type="submit"
            disabled={loading || !quote.trim() || !nombre.trim() || !rol.trim()}
            className={cn('btn-primary flex-1 py-3', (loading || !quote.trim() || !nombre.trim() || !rol.trim()) && 'opacity-50 cursor-not-allowed')}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </SlideOver>
  )
}

export default function TestimoniosClient({ testimoniosIniciales }: Props) {
  const router = useRouter()
  const testimonios = testimoniosIniciales

  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Testimonio | null>(null)
  const [eliminando, setEliminando] = useState<Testimonio | null>(null)
  const [eliminarError, setEliminarError] = useState<string | null>(null)
  const [reordenando, setReordenando] = useState<string | null>(null)

  function refetch() {
    setCreando(false)
    setEditando(null)
    router.refresh()
  }

  async function toggleActivo(t: Testimonio) {
    await fetch(`/api/ops/testimonios/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !t.activo }),
    })
    router.refresh()
  }

  async function mover(t: Testimonio, direccion: -1 | 1) {
    const idx = testimonios.findIndex((x) => x.id === t.id)
    const vecino = testimonios[idx + direccion]
    if (!vecino) return
    setReordenando(t.id)
    await Promise.all([
      fetch(`/api/ops/testimonios/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: vecino.orden }),
      }),
      fetch(`/api/ops/testimonios/${vecino.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: t.orden }),
      }),
    ])
    setReordenando(null)
    router.refresh()
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    const res = await fetch(`/api/ops/testimonios/${eliminando.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setEliminarError(data.error ?? 'No se pudo eliminar.'); return }
    setEliminando(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => setCreando(true)} className="btn-primary px-4 py-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">add</span>
          Nuevo testimonio
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 text-left text-on-surface-variant">
              <th className="px-4 py-3 font-medium w-12">Orden</th>
              <th className="px-4 py-3 font-medium">Avatar</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Testimonio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {testimonios.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">No hay testimonios cargados.</td></tr>
            )}
            {testimonios.map((t, i) => (
              <tr key={t.id} className="border-b border-outline-variant/10 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => mover(t, -1)}
                      disabled={i === 0 || reordenando === t.id}
                      className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                    </button>
                    <button
                      onClick={() => mover(t, 1)}
                      disabled={i === testimonios.length - 1 || reordenando === t.id}
                      className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3"><Avatar testimonio={t} /></td>
                <td className="px-4 py-3 font-medium text-on-surface">{t.nombre}</td>
                <td className="px-4 py-3 text-on-surface-variant">{t.rol}</td>
                <td className="px-4 py-3 text-on-surface-variant max-w-[280px] truncate" title={t.quote}>{t.quote}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActivo(t)}
                    className={cn('px-2 py-0.5 rounded-full text-xs font-medium', t.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}
                  >
                    {t.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditando(t)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-colors"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => { setEliminando(t); setEliminarError(null) }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Eliminar"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creando || editando) && (
        <TestimonioForm
          testimonio={editando}
          open={true}
          onClose={() => { setCreando(false); setEditando(null) }}
          onSaved={refetch}
        />
      )}

      {eliminando && (
        <ConfirmDialog
          open={true}
          title={`Eliminar testimonio de "${eliminando.nombre}"`}
          message={eliminarError ?? '¿Confirmás que querés eliminar este testimonio? Esta acción no se puede deshacer.'}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          variant="danger"
          onConfirm={confirmarEliminar}
          onCancel={() => setEliminando(null)}
        />
      )}
    </div>
  )
}
