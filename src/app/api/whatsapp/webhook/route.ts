import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { whatsappDb, enviarTexto, normalizarTelefonoAR } from '@/lib/whatsapp'
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

const VENTANA_FRESCURA_MS = 60 * 60 * 1000 // 1 hora
const VENTANA_LIMITE_RESPUESTA_MS = 24 * 60 * 60 * 1000 // 24 horas

interface StatusWebhook {
  id?: string
  status?: string
  errors?: Array<{ title?: string; message?: string }>
}

interface MessageWebhook {
  id?: string
  from?: string
  type?: string
  timestamp?: string
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

// No existe un módulo de plan para "link público reservas" en modulos_config
// (se revisó en el PASO 1 — no hay fila, a diferencia de 'whatsapp' o
// 'tipos_turno') — el único control real es si el profesional tiene su
// booking activo. Cliente service_role (db, ya resuelto por el caller),
// nunca el del usuario. Cualquier error se loguea y devuelve null — el
// caller sigue respondiendo sin link, nunca deja de responder.
async function obtenerLinkReserva(db: SupabaseClient, terapeutaId: string): Promise<string | null> {
  try {
    const { data, error } = await db
      .from('profiles')
      .select('booking_slug, booking_activo')
      .eq('id', terapeutaId)
      .maybeSingle()

    if (error) {
      console.error('[whatsapp/webhook] Error al buscar booking_slug:', error)
      return null
    }
    if (!data?.booking_slug || !data.booking_activo) return null

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'
    return `${appUrl}/p/${data.booking_slug}`
  } catch (e) {
    console.error('[whatsapp/webhook] Error al buscar booking_slug:', e)
    return null
  }
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

  let texto = textoRespuesta(resultado)
  if (resultado.ok && resultado.recienAplicado && resultado.estado === 'cancelado') {
    const linkReserva = await obtenerLinkReserva(db, resultado.terapeutaId)
    if (linkReserva) {
      texto = `${texto}\n\nAgendá un nuevo turno:\n${linkReserva}`
    }
  }

  // El número desde el que respondemos es el mismo que recibió el mensaje
  // (metadata.phone_number_id del propio webhook) — más confiable que
  // re-derivarlo por terapeuta_id, y sigue funcionando aunque aplicarAccionTurno
  // haya fallado (token inválido, etc.) y no tengamos profesional resuelto.
  const destinoPhoneNumberId = phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!destinoPhoneNumberId) return

  try {
    await enviarTexto({ to: telefono, phoneNumberId: destinoPhoneNumberId, body: texto })
  } catch (e) {
    console.error('[whatsapp/webhook] Error al responder por WhatsApp:', e)
  }
}

// Respuesta automática a texto libre — costo cero para KLIA (solo enviarTexto,
// nunca una plantilla paga). No guarda el contenido del mensaje del paciente
// en ningún momento (podría ser un dato de salud, Ley 25.326) — solo el
// teléfono, igual que el resto de whatsapp_mensajes.
async function procesarTexto(db: SupabaseClient, message: MessageWebhook, phoneNumberId: string | undefined) {
  const waMessageId = message.id
  const telefono = message.from
  if (!waMessageId || !telefono) return

  // 1) Frescura: un mensaje de más de 1h (reintento tardío de Meta, cola
  // atrasada) no genera respuesta ni deja rastro.
  const timestampMs = message.timestamp ? Number(message.timestamp) * 1000 : NaN
  if (!Number.isFinite(timestampMs) || Date.now() - timestampMs > VENTANA_FRESCURA_MS) return

  // 2) Dedupe — mismo patrón que procesarBoton (wa_message_id UNIQUE).
  const { error: dedupeError } = await db.from('whatsapp_mensajes').insert({
    wa_message_id: waMessageId,
    tipo: 'entrante_texto',
    telefono,
    estado: 'recibido',
  })
  if (dedupeError) {
    if (dedupeError.code !== '23505') {
      console.error('[whatsapp/webhook] Error al registrar mensaje de texto entrante:', dedupeError)
    }
    return
  }

  // 3) Límite: como mucho una respuesta automática por teléfono cada 24hs —
  // evita mandar el mismo texto en cada mensaje de una conversación larga.
  const hace24hs = new Date(Date.now() - VENTANA_LIMITE_RESPUESTA_MS).toISOString()
  const { data: respuestaPrevia } = await db
    .from('whatsapp_mensajes')
    .select('id')
    .eq('telefono', telefono)
    .eq('tipo', 'respuesta_automatica')
    .gte('created_at', hace24hs)
    .limit(1)
    .maybeSingle()
  if (respuestaPrevia) return

  // 4) Resolver profesional — el último recordatorio mandado a este teléfono
  // es la única pista disponible de qué profesional corresponde (el texto
  // entrante no trae esa relación).
  const { data: ultimoRecordatorio } = await db
    .from('whatsapp_mensajes')
    .select('profesional_id')
    .eq('telefono', telefono)
    .eq('tipo', 'recordatorio')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let profesional: { nombre: string; apellido: string; telefono: string | null } | null = null
  if (ultimoRecordatorio?.profesional_id) {
    const { data } = await db
      .from('profiles')
      .select('nombre, apellido, telefono')
      .eq('id', ultimoRecordatorio.profesional_id)
      .maybeSingle()
    profesional = data ?? null
  }

  // Formato internacional (+5491165939115) cuando se puede normalizar; si no
  // (número no-AR, formato que normalizarTelefonoAR no reconoce), se muestra
  // tal cual está cargado en el perfil en vez de omitirlo.
  const telefonoNormalizado = profesional?.telefono ? normalizarTelefonoAR(profesional.telefono) : null
  const telefonoFormateado = telefonoNormalizado ? `+${telefonoNormalizado}` : profesional?.telefono

  const texto = profesional
    ? `Este es un canal automático y no lo atiende una persona.\nPara consultas, comunicate con ${profesional.nombre} ${profesional.apellido}${telefonoFormateado ? `, al ${telefonoFormateado}` : ''}.`
    : 'Este es un canal automático y no lo atiende una persona. Para consultas, comunicate directamente con tu profesional.'

  // 5) Enviar — solo texto libre (enviarTexto), nunca enviarTemplateRecordatorio
  // ni otra plantilla, acá o en cualquier otro punto de este webhook.
  const destinoPhoneNumberId = phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!destinoPhoneNumberId) return

  try {
    await enviarTexto({ to: telefono, phoneNumberId: destinoPhoneNumberId, body: texto })
  } catch (e) {
    console.error('[whatsapp/webhook] Error al responder texto libre por WhatsApp:', e)
    return
  }

  // 6) Registrar el envío — recién si realmente salió, para no activar el
  // límite de 24hs del punto 3 sobre una respuesta que nunca llegó.
  const { error: registroError } = await db.from('whatsapp_mensajes').insert({
    tipo: 'respuesta_automatica',
    telefono,
    estado: 'enviando',
    profesional_id: ultimoRecordatorio?.profesional_id ?? null,
  })
  if (registroError) {
    console.error('[whatsapp/webhook] Error al registrar respuesta automática:', registroError)
  }
}

async function procesarValor(db: SupabaseClient, valor: ValorWebhook) {
  for (const status of valor.statuses ?? []) {
    await procesarStatus(db, status)
  }

  for (const message of valor.messages ?? []) {
    if (message.type === 'button') {
      await procesarBoton(db, message, valor.metadata?.phone_number_id)
    } else if (message.type === 'text') {
      await procesarTexto(db, message, valor.metadata?.phone_number_id)
    }
    // otros tipos (imagen, audio, ubicación, etc.) se ignoran
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
