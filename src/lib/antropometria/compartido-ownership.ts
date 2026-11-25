import { serviceClient } from '@/lib/supabase/service'

type Db = ReturnType<typeof serviceClient>

// El cliente service_role no aplica RLS — este helper es la única barrera real de
// ownership para antropometria_compartidos. Siempre resolver terapeutaId con
// getEffectiveTerapeutaIdServer antes de llamarlo (mismo patrón que
// planPerteneceATerapeuta en src/lib/nutricion/planes-alimentarios-ownership.ts).
export async function pacienteAntropometriaPerteneceATerapeuta(
  db: Db,
  pacienteId: string,
  terapeutaId: string,
): Promise<boolean> {
  const { data } = await db
    .from('pacientes')
    .select('id')
    .eq('id', pacienteId)
    .eq('terapeuta_id', terapeutaId)
    .maybeSingle()
  return !!data
}
