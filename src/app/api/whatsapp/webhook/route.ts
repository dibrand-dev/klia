import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { whatsappDb, enviarTexto } from '@/lib/whatsapp'
import { aplicarAccionTurno } from '@/lib/turnos-accion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// enviando < enviado < entregado < leido — un status tardío (ej. "sent" que
// llega después de "read" por reordenamiento de red) nunca retrocede el
// estado ya alcanzado. "fallido" es terminal y se maneja aparte, fuera de
// este orden.
const ORDEN_ESTADO: Record<string, number> = { enviando: 0, enviado: 1, entregado: 2, leido: 3 }
const MAP_ESTADO_META: Record<string, string> = { sent: 'enviado', delivered: 'entregado', read: 'leido' }

interface StatusWebhook {
  id?: string
  status?: string
  errors?: Array<{ title?: string; message?: string }>
}

interface MessageWebhook {
  id?: string
  from?: string
  type?: string
  button?: { payload?: string; text?: string }
}

interface ValorWebhook {
  metadata?: { phone_number_id?: string }
  messages?: MessageWebhook[]
  statuses?: StatusWebhook[]
}

interface EntradaWebhook {
  entry?: Array<{
    changes?: Array<{ value?: ValorWebhook }>
  }>
}

// Falla cerrado: sin WHATSAPP_APP_SECRET configurado, nunca valida — mismo
// criterio que verificarCron (cron-auth.ts) y verificarFirmaMP.
function validarFirma(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return false

  const header = req.headers.get('x-hub-signature-256') ?? ''
  const esperado = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`

  const a = Buffer.from(header)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

async function procesarStatus(db: SupabaseClient, status: StatusWebhook) {
  if (!status.id) return

  if (status.status === 'failed') {
    const errorMsg = status.errors?.[0]?.title ?? status.errors?.[0]?.message ?? 'error desconocido'
    await db
      .from('whatsapp_mensajes')
      .update({ estado: 'fallido', error: errorMsg, updated_at: new Date().toISOString() })
      .eq('wa_message_id', status.id)
    return
  }

  const nuevoEstado = status.status ? MAP_ESTADO_META[status.status] : undefined
  if (!nuevoEstado) return

  const { data: actual } = await db
    .from('whatsapp_mensajes')
    .select('estado')
    .eq('wa_message_id', status.id)
    .maybeSingle()

  if (!actual) return
  if ((ORDEN_ESTADO[(actual as { estado: string }).estado] ?? -1) >= ORDEN_ESTADO[nuevoEstado]) return

  await db
    .from('whatsapp_mensajes')
    .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
    .eq('wa_message_id', status.id)
}

function textoRespuesta(resultado: Awaited<ReturnType<typeof aplicarAccionTurno>>): string {
  if (!resultado.ok) {
    return 'No pudimos procesar tu respuesta. Si el problema persiste, contactá directamente a tu profesional.'
  }
  if (!resultado.recienAplicado) {
    return `Ya habíamos registrado esta respuesta antes — tu turno sigue ${resultado.estado}.`
  }
  return resultado.estado === 'confirmado'
    ? '¡Listo! Confirmamos tu turno. ✅'
    : 'Cancelamos tu turno. Esperamos verte en otra oportunidad.'
}

async function procesarBoton(db: SupabaseClient, message: MessageWebhook, phoneNumberId: string | undefined) {
  const waMessageId = message.id
  const telefono = message.from
  if (!waMessageId || !telefono) return

  const payload = message.button?.payload ?? ''
  const separador = payload.indexOf(':')
  const accion = separador >= 0 ? payload.slice(0, separador) : ''
  const token = separador >= 0 ? payload.slice(separador + 1) : ''

  if ((accion !== 'confirmar' && accion !== 'cancelar') || !UUID_RE.test(token)) return

  // Dedupe: el id del mensaje entrante tiene UNIQUE en whatsapp_mensajes — si
  // Meta reintenta el mismo webhook (entrega duplicada, muy común en su
  // infra), el insert falla con 23505 y no se vuelve a aplicar la acción ni
  // a responder de nuevo.
  const { error: dedupeError } = await db.from('whatsapp_mensajes').insert({
    wa_message_id: waMessageId,
    tipo: 'entrante_boton',
    telefono,
    estado: 'recibido',
  })

  if (dedupeError) {
    if (dedupeError.code !== '23505') {
      console.error('[whatsapp/webhook] Error al registrar mensaje entrante:', dedupeError)
    }
    return
  }

  const resultado = await aplicarAccionTurno(token, accion)

  // El número desde el que respondemos es el mismo que recibió el mensaje
  // (metadata.phone_number_id del propio webhook) — más confiable que
  // re-derivarlo por terapeuta_id, y sigue funcionando aunque aplicarAccionTurno
  // haya fallado (token inválido, etc.) y no tengamos profesional resuelto.
  const destinoPhoneNumberId = phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!destinoPhoneNumberId) return

  try {
    await enviarTexto({ to: telefono, phoneNumberId: destinoPhoneNumberId, body: textoRespuesta(resultado) })
  } catch (e) {
    console.error('[whatsapp/webhook] Error al responder por WhatsApp:', e)
  }
}

async function procesarValor(db: SupabaseClient, valor: ValorWebhook) {
  for (const status of valor.statuses ?? []) {
    await procesarStatus(db, status)
  }

  for (const message of valor.messages ?? []) {
    if (message.type !== 'button') continue // otros tipos (texto libre, imagen, etc.) se ignoran
    await procesarBoton(db, message, valor.metadata?.phone_number_id)
  }
}

// Verificación del webhook (handshake de Meta al configurarlo en el Business Manager).
export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) return NextResponse.json({ error: 'no_configurado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!validarFirma(req, rawBody)) {
    return NextResponse.json({ error: 'firma_invalida' }, { status: 401 })
  }

  let payload: EntradaWebhook
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }

  const db = whatsappDb()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (!change.value) continue
      try {
        await procesarValor(db, change.value)
      } catch (e) {
        console.error('[whatsapp/webhook] Error procesando evento:', e)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
