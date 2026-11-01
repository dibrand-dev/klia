import type { SupabaseClient } from '@supabase/supabase-js'

// portal_retencion_plan es la única fuente de los días de conservación de las
// fotos del portal — nunca hardcodear el número (mismo criterio que precios
// de planes, CLAUDE.md). Solo tiene filas para los planes que habilitan el
// portal (profesional/premium/bonificado) — esencial no tiene fila, por eso
// el resultado puede ser null.
export async function diasRetencionPorPlan(
  supabase: SupabaseClient,
  plan: string | null,
): Promise<number | null> {
  if (!plan) return null
  const { data } = await supabase
    .from('portal_retencion_plan')
    .select('retencion_dias')
    .eq('plan', plan)
    .maybeSingle()
  return data?.retencion_dias ?? null
}
