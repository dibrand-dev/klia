import { MercadoPagoConfig, PreApprovalPlan, PreApproval } from 'mercadopago'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN_PROD!,
  options: { timeout: 5000 },
})

export const preApprovalPlan = new PreApprovalPlan(mpClient)
export const preApproval = new PreApproval(mpClient)

export type PlanKlia = 'esencial' | 'profesional' | 'premium'
export type Modalidad = 'mensual' | 'anual'

export interface PlanInfo {
  nombre: string
  precio_mensual: number
  precio_anual_mensual: number | null
}

// Fuente única de precios: tabla `planes` en Supabase (nunca hardcodear —
// ver CLAUDE.md). Devuelve null si el slug no existe o está inactivo.
export async function getPlanInfo(
  supabase: SupabaseClient<Database>,
  plan: PlanKlia,
): Promise<PlanInfo | null> {
  const { data, error } = await supabase
    .from('planes')
    .select('nombre, precio_mensual, precio_anual_mensual')
    .eq('slug', plan)
    .eq('activo', true)
    .single()

  if (error || !data) {
    console.error(`[MercadoPago] Plan no encontrado en Supabase (slug: ${plan})`, error)
    return null
  }

  return {
    nombre: data.nombre,
    precio_mensual: Number(data.precio_mensual),
    precio_anual_mensual: data.precio_anual_mensual != null ? Number(data.precio_anual_mensual) : null,
  }
}

// Devuelve null si el plan no existe o si se pide modalidad anual sin que el
// plan tenga precio_anual_mensual configurado — nunca cae a un valor hardcodeado.
export async function getMonto(
  supabase: SupabaseClient<Database>,
  plan: PlanKlia,
  modalidad: Modalidad,
): Promise<number | null> {
  const info = await getPlanInfo(supabase, plan)
  if (!info) return null
  if (modalidad === 'mensual') return info.precio_mensual
  if (info.precio_anual_mensual == null) {
    console.error(`[MercadoPago] Plan ${plan} no tiene precio_anual_mensual configurado en Supabase`)
    return null
  }
  return info.precio_anual_mensual
}
