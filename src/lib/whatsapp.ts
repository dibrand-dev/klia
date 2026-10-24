import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/supabase/service'

// whatsapp_config / whatsapp_mensajes, y las columnas whatsapp_* de
// pacientes/turnos, todavía no están en los tipos generados de Supabase
// (tablas nuevas en STAGING, no en producción) — se re-tipea el mismo
// cliente (mismo fetch cache:'no-store' ya resuelto en serviceClient()) para
// poder usarlas sin pelear con el generic de Database.
export function whatsappDb(): SupabaseClient {
  return serviceClient() as unknown as SupabaseClient
}

const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE = 'https://graph.facebook.com'

// Esquema de numeración argentino: toda línea (fija o móvil) tiene
// característica + abonado = 10 dígitos. El "0" es el prefijo nacional de
// larga distancia y el "15" es el marcador de móvil que se inserta justo
// después de la característica (2 a 4 dígitos) — ninguno de los dos existe
// en el formato internacional que pide WhatsApp (54 9 + los 10 dígitos).
// Si el texto ya viene en formato internacional (con 54 y/o 9) se lo
// normaliza igual, sin asumir que el usuario lo tipeó "a mano" con 0/15.
export function normalizarTelefonoAR(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if (!d) return null

  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('9')) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)

  if (d.length === 12) {
    // Se prueba cada largo posible de característica (2, 3 o 4 dígitos) y se
    // usa el que, al sacarle el "15", deja exactamente los 10 dígitos
    // (característica + abonado) que exige el esquema de numeración AR.
    for (const largoCaracteristica of [2, 3, 4]) {
      if (d.slice(largoCaracteristica, largoCaracteristica + 2) === '15') {
        d = d.slice(0, largoCaracteristica) + d.slice(largoCaracteristica + 2)
        break
      }
    }
  }

  if (d.length !== 10) return null
  return `549${d}`
}

// whatsapp_config permite fijar un número de WhatsApp Business propio por
// profesional (multi-número); sin fila activa, cae al número único de KLIA
// configurado por env var.
export async function resolverPhoneNumberId(profesionalId: string): Promise<string | null> {
  const { data } = await whatsappDb()
    .from('whatsapp_config')
    .select('phone_number_id')
    .eq('profesional_id', profesionalId)
    .eq('activo', true)
    .maybeSingle()

  return (data as { phone_number_id: string } | null)?.phone_number_id
    ?? process.env.WHATSAPP_PHONE_NUMBER_ID
    ?? null
}

async function postGraphApi(phoneNumberId: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) throw new Error('WHATSAPP_TOKEN no configurado')

  const res = await fetch(`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => null) as Record<string, unknown> | null

  if (!res.ok) {
    const errorMsg = (data?.error as { message?: string } | undefined)?.message ?? `WhatsApp API respondió ${res.status}`
    throw new Error(errorMsg)
  }

  return data ?? {}
}

// Plantilla "recordatorio_turno" (es_AR), aprobada en Meta Business Manager,
// con 2 botones de quick reply: Confirmar (index 0) y Cancelar (index 1). El
// payload de cada botón reusa turnos.token_accion tal cual — el mismo token
// opaco que ya usan los links de confirmar/cancelar por mail, sin firmar
// nada nuevo (ver aplicarAccionTurno, que no distingue el canal de origen).
export async function enviarTemplateRecordatorio({
  to, phoneNumberId, params, tokenAccion,
}: {
  to: string
  phoneNumberId: string
  params: [nombre: string, profesional: string, fecha: string, hora: string]
  tokenAccion: string
}): Promise<string> {
  const data = await postGraphApi(phoneNumberId, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'recordatorio_turno',
      language: { code: 'es_AR' },
      components: [
        {
          type: 'body',
          parameters: params.map((text) => ({ type: 'text', text })),
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: 0,
          parameters: [{ type: 'payload', payload: `confirmar:${tokenAccion}` }],
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: 1,
          parameters: [{ type: 'payload', payload: `cancelar:${tokenAccion}` }],
        },
      ],
    },
  })

  const waMessageId = (data.messages as Array<{ id?: string }> | undefined)?.[0]?.id
  if (!waMessageId) throw new Error('WhatsApp API no devolvió message id')
  return waMessageId
}

// Mensaje de texto libre — solo válido dentro de la ventana de 24h desde el
// último mensaje del usuario (ej. responder al botón Confirmar/Cancelar).
// Fuera de esa ventana, Meta lo rechaza y hay que usar una plantilla.
export async function enviarTexto({
  to, phoneNumberId, body,
}: {
  to: string
  phoneNumberId: string
  body: string
}): Promise<void> {
  await postGraphApi(phoneNumberId, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  })
}
