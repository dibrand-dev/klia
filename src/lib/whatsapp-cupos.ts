import type { SupabaseClient } from '@supabase/supabase-js'
import { inicioMesActualAR } from '@/lib/tz'

// Cupo mensual de recordatorios por WhatsApp, por plan (cuentas 'activa'). Un
// plan que no está en este mapa (desconocido, o '' si el profesional no
// tiene plan cargado) tiene cupo 0 — fail-closed, mismo criterio que
// puedeUsarWhatsApp.
export const CUPOS_RECORDATORIOS_MES: Record<string, number> = {
  esencial: 30,
  profesional: 100,
  premium: 150,
  bonificado: 150,
}

// Cupo propio para cuentas en trial — no depende de un plan (todavía no
// eligieron ninguno) y se cuenta desde el inicio del trial, no del mes
// calendario, porque un trial no coincide con ningún mes calendario.
export const CUPO_TRIAL = 30

// Cuenta recordatorios de WhatsApp ya usados desde una fecha dada. Solo tipo
// 'recordatorio' — las respuestas automáticas (entrante_texto, entrante_boton,
// respuesta_automatica, baja_recibida) son otro `tipo` y nunca entran en este
// conteo. 'fallido' no cuenta: un envío que nunca llegó no debería gastarle
// cupo al profesional.
async function contarRecordatoriosDesde(
  supabase: SupabaseClient,
  profesionalId: string,
  desdeISO: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('whatsapp_mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('profesional_id', profesionalId)
    .eq('tipo', 'recordatorio')
    .neq('estado', 'fallido')
    .gte('created_at', desdeISO)

  if (error) {
    console.error('[whatsapp-cupos] Error al contar recordatorios:', profesionalId, error)
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
  estadoCuenta: string | null,
  trialInicio: string | null,
  cache?: Map<string, number>,
): Promise<boolean> {
  const esTrial = estadoCuenta === 'trial'

  // Trial sin trial_inicio cargado no debería pasar nunca en la práctica,
  // pero si pasa, fail-closed — no hay desde dónde contar, así que no se
  // habilita el envío.
  if (esTrial && !trialInicio) return false

  const cupo = esTrial ? CUPO_TRIAL : (CUPOS_RECORDATORIOS_MES[plan] ?? 0)
  if (cupo <= 0) return false

  let usados = cache?.get(profesionalId)
  if (usados === undefined) {
    const desdeISO = esTrial ? new Date(trialInicio as string).toISOString() : inicioMesActualAR().toISOString()
    usados = await contarRecordatoriosDesde(supabase, profesionalId, desdeISO)
    cache?.set(profesionalId, usados)
  }

  return usados < cupo
}
