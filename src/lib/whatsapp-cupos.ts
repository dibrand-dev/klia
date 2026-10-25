import type { SupabaseClient } from '@supabase/supabase-js'
import { inicioMesActualAR } from '@/lib/tz'

// Cupo mensual de recordatorios por WhatsApp, por plan. Un plan que no está
// en este mapa (desconocido, o '' si el profesional no tiene plan cargado)
// tiene cupo 0 — fail-closed, mismo criterio que puedeUsarWhatsApp.
export const CUPOS_RECORDATORIOS_MES: Record<string, number> = {
  esencial: 30,
  profesional: 100,
  premium: 150,
  bonificado: 150,
}

// Cuenta recordatorios de WhatsApp ya usados en lo que va del mes calendario
// actual (hora Argentina). Solo tipo 'recordatorio' — las respuestas
// automáticas (entrante_texto, entrante_boton, respuesta_automatica,
// baja_recibida) son otro `tipo` y nunca entran en este conteo. 'fallido' no
// cuenta: un envío que nunca llegó no debería gastarle cupo al profesional.
export async function recordatoriosEnviadosMes(
  supabase: SupabaseClient,
  profesionalId: string,
): Promise<number> {
  const inicioMes = inicioMesActualAR().toISOString()
  const { count, error } = await supabase
    .from('whatsapp_mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('profesional_id', profesionalId)
    .eq('tipo', 'recordatorio')
    .neq('estado', 'fallido')
    .gte('created_at', inicioMes)

  if (error) {
    console.error('[whatsapp-cupos] Error al contar recordatorios del mes:', profesionalId, error)
    // Fail-closed: si no se puede confirmar cuánto cupo queda, se trata
    // como si ya no quedara nada — nunca se habilita un envío de más.
    return Infinity
  }
  return count ?? 0
}

// cache: Map<profesionalId, usados> compartido por toda una corrida del cron
// — evita volver a contar en Supabase por cada turno del mismo profesional.
// El cron procesa los turnos en serie (nunca en paralelo), así que alcanza
// con incrementar el valor cacheado después de cada envío exitoso; no hace
// falta reservar el cupo antes de enviar ni liberarlo si falla.
export async function hayCupoWhatsapp(
  supabase: SupabaseClient,
  profesionalId: string,
  plan: string,
  cache?: Map<string, number>,
): Promise<boolean> {
  const cupo = CUPOS_RECORDATORIOS_MES[plan] ?? 0
  if (cupo <= 0) return false

  let usados = cache?.get(profesionalId)
  if (usados === undefined) {
    usados = await recordatoriosEnviadosMes(supabase, profesionalId)
    cache?.set(profesionalId, usados)
  }

  return usados < cupo
}
