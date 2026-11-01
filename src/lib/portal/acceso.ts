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

export interface AccesoPaciente {
  pacienteId: string
  terapeutaId: string
}

// Accesos 'activo' del usuario de portal, filtrados a los que su profesional
// TODAVÍA tiene habilitado el portal en este momento — el plan/estado de
// cuenta del profesional puede haber cambiado después de que el paciente
// activó su cuenta, así que "el acceso está activo" nunca alcanza por sí
// solo. Única fuente para decidir qué puede ver una sesión de paciente.
export async function accesosHabilitados(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<AccesoPaciente[]> {
  const { data } = await supabase
    .from('paciente_accesos')
    .select('paciente_id, terapeuta_id')
    .eq('auth_user_id', authUserId)
    .eq('estado', 'activo')

  if (!data || data.length === 0) return []

  const habilitados: AccesoPaciente[] = []
  for (const acceso of data) {
    if (await puedeUsarPortal(supabase, acceso.terapeuta_id)) {
      habilitados.push({ pacienteId: acceso.paciente_id, terapeutaId: acceso.terapeuta_id })
    }
  }
  return habilitados
}

// Para una API /api/portal/* que actúa sobre un paciente_id puntual (Fase 2B
// en adelante): valida que el usuario autenticado tenga un acceso 'activo' a
// ESE paciente Y que el portal siga habilitado para ese profesional ahora
// mismo. Devuelve null si cualquiera de las dos condiciones falla — el
// caller responde 403 { error: 'portal_no_habilitado' }, nunca sigue
// asumiendo que el acceso activo alcanza.
export async function accesoHabilitado(
  supabase: SupabaseClient,
  authUserId: string,
  pacienteId: string,
): Promise<AccesoPaciente | null> {
  const { data: acceso } = await supabase
    .from('paciente_accesos')
    .select('paciente_id, terapeuta_id')
    .eq('auth_user_id', authUserId)
    .eq('paciente_id', pacienteId)
    .eq('estado', 'activo')
    .maybeSingle()

  if (!acceso) return null
  if (!(await puedeUsarPortal(supabase, acceso.terapeuta_id))) return null
  return { pacienteId: acceso.paciente_id, terapeutaId: acceso.terapeuta_id }
}
