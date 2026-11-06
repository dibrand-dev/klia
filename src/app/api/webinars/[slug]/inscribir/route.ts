import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailConfirmacionWebinar } from '@/lib/emails/webinars'
import { estadoWebinar } from '@/lib/webinars/estado'
import { urlGoogleCalendar } from '@/lib/webinars/calendario'
import { validarInscripcion } from '@/lib/webinars/validar'

export const runtime = 'nodejs'

const ALLOWED_ORIGINS = (process.env.WEBINAR_ALLOWED_ORIGINS ?? 'https://www.klia.com.ar')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Rate limit best-effort en memoria por IP — no persiste entre instancias
// ni reinicios de la función serverless, pero alcanza para frenar abuso
// básico de un endpoint público sin captcha.
const VENTANA_MS = 10 * 60 * 1000
const LIMITE_POR_VENTANA = 10
const intentosPorIp = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const ahora = Date.now()
  const entry = intentosPorIp.get(ip)
  if (!entry || ahora > entry.resetAt) {
    intentosPorIp.set(ip, { count: 1, resetAt: ahora + VENTANA_MS })
    return false
  }
  entry.count++
  return entry.count > LIMITE_POR_VENTANA
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const headers = corsHeaders(req.headers.get('origin'))

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'demasiados_intentos' }, { status: 429, headers })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400, headers })
  }

  // Honeypot: si viene con valor, fingir éxito sin insertar ni enviar nada.
  if (body.hp) {
    return NextResponse.json({ ok: true }, { status: 200, headers })
  }

  const supabase = serviceClient()

  const { data: webinar } = await supabase
    .from('webinars')
    .select('id, slug, titulo, fecha_inicio, duracion_min, cierre_inscripcion, url_videoconferencia, estado')
    .eq('slug', params.slug)
    .eq('estado', 'publicado')
    .maybeSingle()

  if (!webinar) {
    return NextResponse.json({ error: 'no_encontrado' }, { status: 404, headers })
  }

  const runtime = estadoWebinar(webinar)
  if (runtime === 'ended') {
    return NextResponse.json({ error: 'finalizado' }, { status: 410, headers })
  }
  if (runtime === 'closed') {
    return NextResponse.json({ error: 'cerrado' }, { status: 410, headers })
  }

  const resultado = validarInscripcion(body)
  if (!resultado.ok) {
    return NextResponse.json({ error: 'validacion', campos: resultado.campos }, { status: 400, headers })
  }
  const datos = resultado.data

  const utmCrudo = (body.utm && typeof body.utm === 'object') ? body.utm as Record<string, unknown> : {}
  const utm: Record<string, string> = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const v = utmCrudo[key]
    if (typeof v === 'string' && v.trim() && v.length <= 100) utm[key] = v.trim()
  }

  // Idempotencia: chequeo previo (email ya normalizado a minúsculas antes de
  // guardar, así un .eq exacto equivale a comparar por lower(email), que es
  // el criterio del índice único webinar_id+lower(email)) + fallback a la
  // violación de ese índice si dos requests llegan en simultáneo.
  const { data: existente } = await supabase
    .from('inscripciones_webinar')
    .select('id')
    .eq('webinar_id', webinar.id)
    .eq('email', datos.email)
    .maybeSingle()

  let already = !!existente

  if (!existente) {
    const { error: insertError } = await supabase.from('inscripciones_webinar').insert({
      webinar_id: webinar.id,
      nombre_apellido: datos.nombre_apellido,
      institucion: datos.institucion,
      email: datos.email,
      telefono: datos.telefono,
      especialidad: datos.especialidad,
      respuestas: datos.respuestas,
      utm: Object.keys(utm).length > 0 ? utm : null,
      consentimiento_at: new Date().toISOString(),
    })

    if (insertError) {
      if (insertError.code === '23505') {
        already = true
      } else {
        console.error('[webinars/inscribir] Error insertando inscripción', insertError.message)
        return NextResponse.json({ error: 'error_interno' }, { status: 500, headers })
      }
    }
  }

  // Mail de confirmación — se reenvía también si already=true. Un fallo de
  // Brevo nunca hace fallar la inscripción: se loguea y la marca queda null
  // para poder detectar el caso, pero la respuesta sigue siendo ok.
  try {
    const html = emailConfirmacionWebinar({
      nombre: datos.nombre_apellido,
      titulo: webinar.titulo,
      fecha_inicio: webinar.fecha_inicio,
      duracion_min: webinar.duracion_min,
      url_videoconferencia: webinar.url_videoconferencia,
      urlAgendar: urlGoogleCalendar(webinar),
    })
    await enviarEmail({
      destinatario: datos.email,
      nombreDestinatario: datos.nombre_apellido,
      asunto: `Confirmación — ${webinar.titulo}`,
      htmlContent: html,
    })
    await supabase
      .from('inscripciones_webinar')
      .update({ confirmacion_enviada_at: new Date().toISOString() })
      .eq('webinar_id', webinar.id)
      .eq('email', datos.email)
  } catch (err) {
    console.error('[webinars/inscribir] Error enviando mail de confirmación', webinar.id, (err as Error)?.message)
  }

  return NextResponse.json({
    ok: true,
    already,
    meet_url: webinar.url_videoconferencia,
    webinar: {
      titulo: webinar.titulo,
      fecha_inicio: webinar.fecha_inicio,
      duracion_min: webinar.duracion_min,
    },
  }, { status: 200, headers })
}
