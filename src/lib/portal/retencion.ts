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

// Vencida "en vivo": no depender solo de portal_registros.foto_vencida (que
// recién lo pone el cron de retención, hasta una vez por día) — un registro
// ya cumplió sus días de conservación apenas pasa la fecha, aunque el cron
// todavía no corrió. Las tres rutas que sirven o listan fotos (hoy, registros
// del profesional, fotos) usan este cálculo en vez del flag crudo; el flag
// (y el borrado real de los blobs) sigue siendo responsabilidad exclusiva
// del cron. Sin fila de retención para el plan, nunca vence por cálculo —
// solo el flag ya puesto manda.
export function fotoVencida(
  registro: { foto_vencida: boolean; registrado_at: string },
  diasRetencion: number | null,
): boolean {
  if (registro.foto_vencida) return true
  if (diasRetencion == null) return false
  const vencimiento = new Date(registro.registrado_at).getTime() + diasRetencion * 86400000
  return Date.now() >= vencimiento
}
