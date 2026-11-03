import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface TerapeutaEfectivo {
  terapeutaId: string
  esColaborador: boolean
  veCobros: boolean
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

  // Cuenta del portal del paciente — nunca actúa como profesional. Se decide
  // por app_metadata, que el usuario NO puede editar desde el cliente (solo
  // lo escribe el server con service_role) — nunca por user_metadata, que sí
  // es editable con auth.updateUser() y por eso nunca sirve para autorizar.
  if (user.app_metadata?.tipo_cuenta === 'paciente') return null

  const { data: colaboracion } = await supabase
    .from('colaboradores')
    .select('profesional_id, ve_cobros')
    .eq('colaborador_id', user.id)
    .eq('activo', true)
    .eq('invitacion_aceptada', true)
    .maybeSingle()

  if (colaboracion) {
    return { terapeutaId: colaboracion.profesional_id, esColaborador: true, veCobros: colaboracion.ve_cobros }
  }

  return { terapeutaId: user.id, esColaborador: false, veCobros: true }
}
