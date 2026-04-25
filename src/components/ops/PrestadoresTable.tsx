'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ProfileWithLastSignIn } from '@/types/database'
import SlideOver from '@/components/ui/SlideOver'

type Row = ProfileWithLastSignIn & { paused: boolean }

function RowMenu({
  id,
  paused,
  onEdit,
  onPause,
  onDelete,
}: {
  id: string
  paused: boolean
  onEdit: () => void
  onPause: () => void
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
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 min-w-[160px] z-10 py-1">
          <Link
            href={`/ops/prestadores/${id}`}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            Editar
          </Link>
          <button
            onClick={() => { setOpen(false); onPause() }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {paused ? 'Reactivar' : 'Pausar'}
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

function DeletePanel({
  prestador,
  loading,
  onCancel,
  onConfirm,
}: {
  prestador: Row | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <SlideOver
      open={prestador !== null}
      onClose={onCancel}
      title="Eliminar prestador"
      width="sm"
    >
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
            <button onClick={onCancel} disabled={loading} className="btn-secondary flex-1 py-2.5">
              Cancelar
            </button>
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

export default function PrestadoresTable({ prestadores }: { prestadores: ProfileWithLastSignIn[] }) {
  const [rows, setRows] = useState<Row[]>(prestadores.map((p) => ({ ...p, paused: false })))
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handlePause(id: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, paused: !r.paused } : r))
    const row = rows.find((r) => r.id === id)
    showToast(row?.paused ? 'Cuenta reactivada (integración pendiente)' : 'Cuenta pausada (integración pendiente)')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    const id = deleteTarget.id

    const { data: pacientes } = await supabase
      .from('pacientes')
      .select('id')
      .eq('terapeuta_id', id)

    const pacienteIds = (pacientes ?? []).map((p) => p.id)

    if (pacienteIds.length > 0) {
      await supabase.from('notas_clinicas').delete().in('paciente_id', pacienteIds)
      await supabase.from('objetivos_terapeuticos').delete().in('paciente_id', pacienteIds)
      await supabase.from('medicacion_paciente').delete().in('paciente_id', pacienteIds)
    }
    await supabase.from('turnos').delete().eq('terapeuta_id', id)
    await supabase.from('pacientes').delete().eq('terapeuta_id', id)
    await supabase.from('profiles').delete().eq('id', id)

    const name = `${deleteTarget.nombre} ${deleteTarget.apellido}`
    setRows((prev) => prev.filter((r) => r.id !== id))
    setDeleteTarget(null)
    setDeleting(false)
    showToast(`${name} eliminado correctamente`)
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

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
              <th className="px-6 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-outline-variant/5 hover:bg-surface-container-lowest transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/ops/prestadores/${p.id}`} className="font-medium text-primary-600 hover:underline block">
                    {p.nombre} {p.apellido}
                  </Link>
                  <Link href={`/ops/prestadores/${p.id}`} className="text-xs text-gray-500 hover:text-primary-600 transition-colors block">
                    {p.email}
                  </Link>
                </td>
                <td className="px-6 py-4 text-on-surface-variant">{p.especialidad ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-surface-container font-medium text-on-surface-variant">—</span>
                </td>
                <td className="px-6 py-4">
                  {!p.email_confirmed_at
                    ? <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">Pendiente</span>
                    : p.paused
                      ? <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 font-semibold">Pausado</span>
                      : <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">Activo</span>
                  }
                </td>
                <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                  {format(parseISO(p.created_at), 'd MMM yyyy', { locale: es })}
                </td>
                <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                  {p.last_sign_in_at ? format(parseISO(p.last_sign_in_at), 'dd/MM/yy HH:mm:ss') : '—'}
                </td>
                <td className="px-6 py-4">
                  <RowMenu
                    id={p.id}
                    paused={p.paused}
                    onEdit={() => {}}
                    onPause={() => handlePause(p.id)}
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
