'use client'

import { useCallback, useEffect, useState } from 'react'
import SedesSection from './SedesSection'
import HorariosPorSedeSection from './HorariosPorSedeSection'
import SedeSlideOver from './SedeSlideOver'
import type { HorarioSucursal, Sucursal } from '@/types/database'

// tieneTurnos es derivado — lo agrega GET /api/sedes, no viene en las respuestas
// de POST/PATCH de una sede individual (ver merges abajo, que lo preservan).
type SucursalConTurnos = Sucursal & { tieneTurnos?: boolean }

interface Props {
  plan: string
  onMultiChange?: (multi: boolean) => void
}

// Orquesta Sedes + Horarios por sede.
// - El listado de sedes (SedesSection) siempre se renderiza — su propio atLimit
//   interno decide si "Agregar sede" queda habilitado o bloqueado con upsell.
//   Así se puede pasar de 1 a 2 sedes desde la UI (antes, con sedes.length<=1
//   ocultando todo, nadie podía crear nunca su primera sede adicional), y un
//   profesional en Esencial (límite 1, ya con su única sede) ve el mismo estado
//   bloqueado+upsell que un Profesional/Premium en su propio límite — no se le
//   oculta la sección.
// - El editor de "Horarios por sede" (y el flag que oculta la sección "Horarios de
//   atención" legacy en AjustesClient.tsx) sigue exactamente igual que antes:
//   recién aparece con 2+ sedes reales. Con 0 o 1 sede real, profiles.horarios_por_dia
//   sigue siendo la fuente de disponibilidad/route.ts, sin cambios.
export default function SedesHorariosSection({ plan, onMultiChange }: Props) {
  const [sedes, setSedes] = useState<SucursalConTurnos[] | null>(null)
  const [horariosPorSede, setHorariosPorSede] = useState<Record<string, HorarioSucursal[]>>({})
  const [sedeSeleccionadaId, setSedeSeleccionadaId] = useState<string | null>(null)
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [sedeEnEdicion, setSedeEnEdicion] = useState<SucursalConTurnos | null>(null)

  const cargarSedes = useCallback(async () => {
    const res = await fetch('/api/sedes')
    if (!res.ok) return
    const { sedes: lista } = await res.json() as { sedes: SucursalConTurnos[] }
    setSedes(lista)
    if (lista.length >= 1) {
      const entries = await Promise.all(lista.map(async s => {
        const r = await fetch(`/api/sedes/${s.id}/horarios`)
        const { horarios } = await r.json() as { horarios: HorarioSucursal[] }
        return [s.id, horarios ?? []] as const
      }))
      setHorariosPorSede(Object.fromEntries(entries))
      setSedeSeleccionadaId(prev => (prev && lista.some(s => s.id === prev)) ? prev : (lista[0]?.id ?? null))
    }
  }, [])

  useEffect(() => { cargarSedes() }, [cargarSedes])

  useEffect(() => {
    onMultiChange?.((sedes?.length ?? 0) > 1)
  }, [sedes, onMultiChange])

  if (!sedes) return null

  // Piso de 1: el profesional siempre tiene "su" sede actual, aunque todavía no
  // haya creado ninguna fila real en sucursales (hoy, 0 para todos) — con esto
  // SedesSection siempre tiene algo que mostrar. Su propio atLimit interno decide
  // si el botón "Agregar sede" queda habilitado o bloqueado con upsell (Esencial
  // con su única sede se comporta igual que Profesional/Premium en el límite: no
  // se oculta la sección, se bloquea el alta con el mismo estado ya implementado).
  const esMulti = sedes.length > 1

  async function handleToggleActivo(sede: Sucursal) {
    const res = await fetch(`/api/sedes/${sede.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !sede.activo }),
    })
    if (res.ok) {
      const { sede: actualizada } = await res.json()
      // El PATCH no devuelve tieneTurnos (es derivado, solo lo calcula el GET) —
      // se preserva el que ya tenía la sede en el estado local.
      setSedes(prev => (prev ?? []).map(s => s.id === sede.id ? { ...actualizada, tieneTurnos: s.tieneTurnos } : s))
    }
  }

  function handleSedeGuardada(sede: Sucursal) {
    setSedes(prev => {
      const existe = (prev ?? []).some(s => s.id === sede.id)
      if (existe) {
        return (prev ?? []).map(s => s.id === sede.id ? { ...sede, tieneTurnos: s.tieneTurnos } : s)
      }
      return [...(prev ?? []), { ...sede, tieneTurnos: false }]
    })
    setHorariosPorSede(prev => prev[sede.id] ? prev : { ...prev, [sede.id]: [] })
  }

  function handleSedeEliminada(id: string) {
    setSedes(prev => (prev ?? []).filter(s => s.id !== id))
    setHorariosPorSede(prev => {
      const { [id]: _, ...resto } = prev
      return resto
    })
    if (sedeSeleccionadaId === id) {
      const restante = (sedes ?? []).find(s => s.id !== id)
      setSedeSeleccionadaId(restante?.id ?? null)
    }
  }

  function handleHorarioGuardado(sedeId: string, horarios: HorarioSucursal[]) {
    setHorariosPorSede(prev => ({ ...prev, [sedeId]: horarios }))
  }

  const coloresUsados = sedes.map(s => s.color)

  return (
    <>
      <SedesSection
        sedes={sedes}
        horariosPorSede={horariosPorSede}
        plan={plan}
        onAdd={() => { setSedeEnEdicion(null); setSlideOverOpen(true) }}
        onEdit={sede => { setSedeEnEdicion(sede); setSlideOverOpen(true) }}
        onVerHorario={sede => setSedeSeleccionadaId(sede.id)}
        onToggleActivo={handleToggleActivo}
      />

      {esMulti && sedeSeleccionadaId && (
        <HorariosPorSedeSection
          sedes={sedes}
          sedeSeleccionadaId={sedeSeleccionadaId}
          onSeleccionarSede={setSedeSeleccionadaId}
          horariosPorSede={horariosPorSede}
          onGuardado={handleHorarioGuardado}
        />
      )}

      <SedeSlideOver
        open={slideOverOpen}
        onClose={() => setSlideOverOpen(false)}
        sede={sedeEnEdicion}
        coloresUsados={coloresUsados}
        onSaved={handleSedeGuardada}
        onDeleted={handleSedeEliminada}
      />
    </>
  )
}
