'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ObraSocial } from '@/types/database'

type Props = {
  obras: ObraSocial[]
  pendientes: ObraSocial[]
  showPendientes?: boolean
}

export default function ObrasSocialesTable({ obras, pendientes, showPendientes = false }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  // — Activas: edición inline
  const [editando, setEditando] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPlan, setEditPlan] = useState('')

  // — Pendientes: normalización
  const [normalizando, setNormalizando] = useState<string | null>(null)
  const [nombreNorm, setNombreNorm] = useState('')

  // ─── helpers ───────────────────────────────────────────────

  async function actualizarPacientes(nombreOriginal: string, nombreFinal: string) {
    const supabase = createClient()
    await supabase.rpc('admin_validar_pacientes_obra_social', {
      p_nombre_original: nombreOriginal,
      p_nombre_final: nombreFinal,
    })
  }

  // ─── Activas: guardar edición ───────────────────────────────

  async function guardarEdicion(obra: ObraSocial) {
    const nombre = editNombre.trim()
    const plan = editPlan.trim() || null
    if (!nombre) return
    setLoading(obra.id)
    const supabase = createClient()

    await supabase
      .from('obras_sociales')
      .update({ nombre, plan })
      .eq('id', obra.id)

    if (nombre.toLowerCase() !== obra.nombre.toLowerCase()) {
      await actualizarPacientes(obra.nombre, nombre)
    }

    setEditando(null)
    router.refresh()
    setLoading(null)
  }

  // ─── Pendientes: validar ────────────────────────────────────

  async function validar(obra: ObraSocial) {
    setLoading(obra.id)
    const supabase = createClient()
    await supabase.from('obras_sociales').update({ validada: true }).eq('id', obra.id)
    await actualizarPacientes(obra.nombre, obra.nombre)
    router.refresh()
    setLoading(null)
  }

  async function confirmarNormalizacion(obra: ObraSocial) {
    const nombre = nombreNorm.trim()
    if (!nombre) return
    setLoading(obra.id)
    const supabase = createClient()

    const { data: existing } = await supabase
      .from('obras_sociales')
      .select('id, veces_ingresada')
      .ilike('nombre', nombre)
      .eq('validada', true)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('obras_sociales')
        .update({ veces_ingresada: existing.veces_ingresada + obra.veces_ingresada })
        .eq('id', existing.id)
      await supabase.from('obras_sociales').delete().eq('id', obra.id)
    } else {
      await supabase
        .from('obras_sociales')
        .update({ nombre, validada: true })
        .eq('id', obra.id)
    }

    await actualizarPacientes(obra.nombre, nombre)
    setNormalizando(null)
    setNombreNorm('')
    router.refresh()
    setLoading(null)
  }

  async function descartar(id: string) {
    setLoading(id)
    const supabase = createClient()
    await supabase.from('obras_sociales').delete().eq('id', id)
    router.refresh()
    setLoading(null)
  }

  // ─── Activas ────────────────────────────────────────────────

  if (!showPendientes) {
    if (obras.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-3 opacity-40">health_and_safety</span>
          <p className="text-sm font-medium">No hay obras sociales activas todavía</p>
        </div>
      )
    }

    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant/20 bg-surface-container-lowest">
            <th className="text-left px-6 py-3 font-semibold text-on-surface-variant">Nombre</th>
            <th className="text-left px-6 py-3 font-semibold text-on-surface-variant">Plan</th>
            <th className="text-left px-4 py-3 font-semibold text-on-surface-variant">Usos</th>
            <th className="px-6 py-3 w-32" />
          </tr>
        </thead>
        <tbody>
          {obras.map((obra) => (
            <tr key={obra.id} className="border-b border-outline-variant/10 last:border-0">
              {editando === obra.id ? (
                <>
                  <td className="px-6 py-3">
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      className="input-field text-sm w-full"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') guardarEdicion(obra)
                        if (e.key === 'Escape') setEditando(null)
                      }}
                    />
                  </td>
                  <td className="px-6 py-3">
                    <input
                      type="text"
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value)}
                      placeholder="Ej: Plata, 310, Gold..."
                      className="input-field text-sm w-full"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') guardarEdicion(obra)
                        if (e.key === 'Escape') setEditando(null)
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{obra.veces_ingresada}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => guardarEdicion(obra)}
                        disabled={!editNombre.trim() || loading === obra.id}
                        className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-6 py-4 font-medium text-on-surface">{obra.nombre}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{obra.plan || '—'}</td>
                  <td className="px-4 py-4 text-on-surface-variant">{obra.veces_ingresada}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setEditando(obra.id)
                          setEditNombre(obra.nombre)
                          setEditPlan(obra.plan ?? '')
                        }}
                        disabled={loading === obra.id}
                        className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  // ─── Pendientes ─────────────────────────────────────────────

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-outline-variant/20 bg-surface-container-lowest">
          <th className="text-left px-6 py-3 font-semibold text-on-surface-variant">Nombre ingresado</th>
          <th className="text-left px-6 py-3 font-semibold text-on-surface-variant">Plan</th>
          <th className="text-left px-4 py-3 font-semibold text-on-surface-variant">Veces ingresada</th>
          <th className="px-6 py-3" />
        </tr>
      </thead>
      <tbody>
        {pendientes.map((obra) => (
          <tr key={obra.id} className="border-b border-outline-variant/10 last:border-0">
            <td className="px-6 py-4 font-medium text-on-surface">{obra.nombre}</td>
            <td className="px-6 py-4 text-on-surface-variant">{obra.plan || '—'}</td>
            <td className="px-4 py-4 text-on-surface-variant">{obra.veces_ingresada}</td>
            <td className="px-6 py-4">
              {normalizando === obra.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nombreNorm}
                    onChange={(e) => setNombreNorm(e.target.value)}
                    placeholder="Nombre correcto..."
                    className="input-field text-sm w-48"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmarNormalizacion(obra)
                      if (e.key === 'Escape') { setNormalizando(null); setNombreNorm('') }
                    }}
                  />
                  <button
                    onClick={() => confirmarNormalizacion(obra)}
                    disabled={!nombreNorm.trim() || loading === obra.id}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { setNormalizando(null); setNombreNorm('') }}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => validar(obra)}
                    disabled={loading === obra.id}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Validar
                  </button>
                  <button
                    onClick={() => { setNormalizando(obra.id); setNombreNorm(obra.nombre) }}
                    disabled={loading === obra.id}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Normalizar
                  </button>
                  <button
                    onClick={() => descartar(obra.id)}
                    disabled={loading === obra.id}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Descartar
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
