import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModuloConfig } from '@/types/database'

export async function getModulosConfig(supabase: SupabaseClient): Promise<ModuloConfig[]> {
  const { data } = await supabase
    .from('modulos_config')
    .select('modulo_id, nombre, descripcion, icono, ruta, planes, activo')
    .eq('activo', true)
    .order('modulo_id')
  return (data ?? []) as ModuloConfig[]
}

export function puedeAcceder(moduloId: string, plan: string, modulos: ModuloConfig[]): boolean {
  const m = modulos.find(m => m.modulo_id === moduloId)
  if (!m) return true
  return m.planes.includes(plan)
}

// Fail-closed para 'tipos_turno' — a diferencia de puedeAcceder (que deja pasar
// si el módulo no existe en modulos_config, pensado para features viejas sin
// fila propia), si esta fila falta, está inactiva, o la lectura falla, se
// deniega. Es server-side: recibe el client ya resuelto por el caller (service
// client, mismo patrón que el resto de los endpoints de /api), nunca lee el
// plan del usuario logueado — el caller debe resolverlo con
// getEffectiveTerapeutaIdServer antes de llamar a esto.
export async function puedeUsarTiposTurno(
  supabase: SupabaseClient,
  plan: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('modulos_config')
    .select('planes')
    .eq('modulo_id', 'tipos_turno')
    .eq('activo', true)
    .maybeSingle()

  if (error || !data) return false
  return data.planes.includes(plan)
}

// Mismo criterio fail-closed que puedeUsarTiposTurno, pero resuelve el plan
// del profesional acá adentro — a diferencia de esa (que lo recibe ya
// resuelto por el caller), el cron de recordatorios y el webhook de
// WhatsApp solo tienen a mano el terapeuta_id, nunca el plan ya leído.
//
// Además del plan habilitado en modulos_config, exige una fila propia en
// whatsapp_cuentas_habilitadas — habilitación manual por cuenta (ej. número
// de WhatsApp Business asignado), no alcanza con que el plan lo permita.
// Fail-closed: cualquier error o ausencia en cualquiera de los dos checks
// deniega el acceso.
export async function puedeUsarWhatsApp(
  supabase: SupabaseClient,
  profesionalId: string,
): Promise<boolean> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', profesionalId)
    .maybeSingle()

  if (profileError || !profile) return false

  const { data, error } = await supabase
    .from('modulos_config')
    .select('planes')
    .eq('modulo_id', 'whatsapp')
    .eq('activo', true)
    .maybeSingle()

  if (error || !data) return false
  if (!data.planes.includes(profile.plan ?? '')) return false

  const { data: habilitada, error: habilitadaError } = await supabase
    .from('whatsapp_cuentas_habilitadas')
    .select('profile_id')
    .eq('profile_id', profesionalId)
    .maybeSingle()

  if (habilitadaError || !habilitada) return false

  return true
}
