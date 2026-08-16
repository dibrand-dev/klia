import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface TerapeutaEfectivo {
  terapeutaId: string
  esColaborador: boolean
}

// Resuelve de quién son los datos que tiene que ver la sesión actual: del propio
// usuario si es profesional, o del profesional al que asiste si es colaboradora
// (secretaria) activa con la invitación aceptada. Punto único de esta resolución —
// evita que cada call site tenga que saber si está hablando con un profesional o
// con alguien que actúa en su nombre.
export async function getEffectiveTerapeutaIdServer(
  supabase: SupabaseClient<Database>
): Promise<TerapeutaEfectivo | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: colaboracion } = await supabase
    .from('colaboradores')
    .select('profesional_id')
    .eq('colaborador_id', user.id)
    .eq('activo', true)
    .eq('invitacion_aceptada', true)
    .maybeSingle()

  if (colaboracion) {
    return { terapeutaId: colaboracion.profesional_id, esColaborador: true }
  }

  return { terapeutaId: user.id, esColaborador: false }
}
