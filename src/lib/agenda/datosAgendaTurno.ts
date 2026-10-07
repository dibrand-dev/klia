import type { SupabaseClient } from '@supabase/supabase-js'
import type { TipoTurno } from '@/types/database'
import { puedeUsarTiposTurno } from '@/lib/modulos'

export type SedeAgendaTurno = {
  id: string
  nombre: string
  direccion: string | null
  es_online: boolean
  color: string
  orden: number
}

export type TipoTurnoConSedes = TipoTurno & { sucursalIds: string[] }

export interface DatosAgendaTurno {
  sedesActivas: SedeAgendaTurno[]
  tiposTurno: TipoTurnoConSedes[]
  tiposTurnoHabilitado: boolean
}

// Punto único para las 3 entradas a NuevoTurnoPageForm (Agenda, la página
// standalone /turnos/nuevo, y el SlideOver global de AppShell) — las tres
// necesitan exactamente lo mismo: sedes activas, el catálogo completo de
// tipos propios (con qué sedes ofrece cada uno) y si el plan los habilita.
export async function obtenerDatosAgendaTurno(
  db: SupabaseClient,
  terapeutaId: string,
  plan: string,
): Promise<DatosAgendaTurno> {
  const [{ data: sedes }, { data: tiposTurnoData }, habilitado] = await Promise.all([
    db.from('sucursales')
      .select('id, nombre, direccion, es_online, color, orden')
      .eq('terapeuta_id', terapeutaId)
      .eq('activo', true)
      .order('orden', { ascending: true }),
    db.from('tipos_turno')
      .select('*')
      .eq('terapeuta_id', terapeutaId)
      .order('orden', { ascending: true }),
    puedeUsarTiposTurno(db, plan),
  ])

  const tiposBase: TipoTurno[] = tiposTurnoData ?? []
  const ids = tiposBase.map((t) => t.id)

  const sucursalIdsPorTipo: Record<string, string[]> = {}
  if (ids.length > 0) {
    const { data: relaciones } = await db
      .from('tipos_turno_sucursales')
      .select('tipo_turno_id, sucursal_id')
      .in('tipo_turno_id', ids)
    for (const r of relaciones ?? []) {
      (sucursalIdsPorTipo[r.tipo_turno_id] ??= []).push(r.sucursal_id)
    }
  }

  const tiposTurno: TipoTurnoConSedes[] = tiposBase.map((t) => ({
    ...t,
    sucursalIds: sucursalIdsPorTipo[t.id] ?? [],
  }))

  return {
    sedesActivas: sedes ?? [],
    tiposTurno,
    tiposTurnoHabilitado: habilitado,
  }
}
