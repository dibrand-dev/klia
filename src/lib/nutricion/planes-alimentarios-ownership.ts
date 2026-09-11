import { serviceClient } from '@/lib/supabase/service'

type Db = ReturnType<typeof serviceClient>

// El cliente service_role no aplica RLS — estos helpers son la única barrera
// real de ownership para planes_alimentarios/plan_comidas/plan_comida_items.
// Siempre resolver terapeutaId con getEffectiveTerapeutaIdServer antes de llamarlos.

export async function planPerteneceATerapeuta(
  db: Db,
  planId: string,
  terapeutaId: string,
): Promise<boolean> {
  const { data } = await db
    .from('planes_alimentarios')
    .select('id')
    .eq('id', planId)
    .eq('terapeuta_id', terapeutaId)
    .maybeSingle()
  return !!data
}

export async function comidaConOwnership(
  db: Db,
  comidaId: string,
): Promise<{ id: string; plan_id: string; terapeutaId: string } | null> {
  const { data } = await db
    .from('plan_comidas')
    .select('id, plan_id, planes_alimentarios!inner(terapeuta_id)')
    .eq('id', comidaId)
    .maybeSingle()
  if (!data) return null
  const plan = data.planes_alimentarios as unknown as { terapeuta_id: string } | { terapeuta_id: string }[]
  const terapeutaId = Array.isArray(plan) ? plan[0]?.terapeuta_id : plan?.terapeuta_id
  if (!terapeutaId) return null
  return { id: data.id, plan_id: data.plan_id, terapeutaId }
}

export async function itemConOwnership(
  db: Db,
  itemId: string,
): Promise<{ id: string; comida_id: string; terapeutaId: string } | null> {
  const { data } = await db
    .from('plan_comida_items')
    .select('id, comida_id, plan_comidas!inner(planes_alimentarios!inner(terapeuta_id))')
    .eq('id', itemId)
    .maybeSingle()
  if (!data) return null
  const comida = data.plan_comidas as unknown as { planes_alimentarios: { terapeuta_id: string } | { terapeuta_id: string }[] } | { planes_alimentarios: { terapeuta_id: string } | { terapeuta_id: string }[] }[]
  const comidaObj = Array.isArray(comida) ? comida[0] : comida
  const plan = comidaObj?.planes_alimentarios
  const terapeutaId = Array.isArray(plan) ? plan[0]?.terapeuta_id : plan?.terapeuta_id
  if (!terapeutaId) return null
  return { id: data.id, comida_id: data.comida_id, terapeutaId }
}
