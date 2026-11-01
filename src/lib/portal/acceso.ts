import type { SupabaseClient } from '@supabase/supabase-js'

// Fail-closed, mismo criterio exacto que puedeUsarWhatsApp (src/lib/modulos.ts):
// allowlist de estado_cuenta (no blocklist) — un estado que no conocemos
// todavía deniega, no permite. Server-side: recibe el client ya resuelto por
// el caller, nunca lee la sesión logueada por su cuenta.
export async function puedeUsarPortal(
  supabase: SupabaseClient,
  terapeutaId: string,
): Promise<boolean> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, estado_cuenta')
    .eq('id', terapeutaId)
    .maybeSingle()

  if (profileError || !profile) return false
  if (profile.estado_cuenta !== 'trial' && profile.estado_cuenta !== 'activa') return false

  const { data, error } = await supabase
    .from('modulos_config')
    .select('planes')
    .eq('modulo_id', 'portal_paciente')
    .eq('activo', true)
    .maybeSingle()

  if (error) return false
  return !!data?.planes.includes(profile.plan ?? '')
}
