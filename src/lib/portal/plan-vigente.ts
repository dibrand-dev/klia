import type { SupabaseClient } from '@supabase/supabase-js'
import { hoyFechaAR } from '@/lib/tz'

export interface PlanVigente {
  id: string
  createdAt: string
}

// Plan vigente de una fecha puntual: el más reciente (no archivado, incluye
// 'pasado') cuya fecha de creación (civil ART) sea anterior o igual a esa
// fecha — no necesariamente el plan 'activo' hoy, uno 'pasado' puede ser el
// vigente de una fecha histórica. Usado por /api/portal/hoy y por
// /api/portal/registros (la comida que se está registrando tiene que
// pertenecer a ESTE plan, no al activo).
export async function planVigentePorFecha(
  supabase: SupabaseClient,
  pacienteId: string,
  terapeutaId: string,
  fecha: string,
): Promise<PlanVigente | null> {
  const { data: planesRaw } = await supabase
    .from('planes_alimentarios')
    .select('id, created_at')
    .eq('paciente_id', pacienteId)
    .eq('terapeuta_id', terapeutaId)
    .neq('estado', 'archivado')
    .order('created_at', { ascending: false })

  const planes = planesRaw ?? []
  // Ya viene ordenado por created_at desc, así que el primer match es el más reciente.
  const plan = planes.find((p) => hoyFechaAR(new Date(p.created_at)) <= fecha) ?? null
  return plan ? { id: plan.id, createdAt: plan.created_at } : null
}
