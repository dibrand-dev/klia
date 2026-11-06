import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { verificarCron } from '@/lib/cron-auth'
import { serviceClient } from '@/lib/supabase/service'
import { enviarEmail } from '@/lib/brevo'
import { emailRecordatorio1dWebinar, emailRecordatorio30mWebinar, emailPostEventoWebinar } from '@/lib/emails/webinars'
import { urlGoogleCalendar } from '@/lib/webinars/calendario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ENVIOS_POR_CORRIDA = 200
const HORA_MS = 60 * 60 * 1000
const MIN_MS = 60 * 1000

type TipoRecordatorio = 'recordatorio_1d' | 'recordatorio_30m' | 'postevento'
const FLAG_COLUMNA: Record<TipoRecordatorio, string> = {
  recordatorio_1d: 'recordatorio_1d_enviado_at',
  recordatorio_30m: 'recordatorio_30m_enviado_at',
  postevento: 'postevento_enviado_at',
}

interface WebinarRow {
  id: string
  slug: string
  titulo: string
  fecha_inicio: string
  duracion_min: number
  url_videoconferencia: string
}

interface InscripcionRow {
  id: string
  nombre_apellido: string
  email: string
}

async function procesarTipo(
  supabase: SupabaseClient,
  tipo: TipoRecordatorio,
  webinar: WebinarRow,
  inscriptos: InscripcionRow[],
  cupoRestante: { n: number },
): Promise<{ enviados: number; fallidos: number }> {
  const flagColumna = FLAG_COLUMNA[tipo]
  let enviados = 0
  let fallidos = 0

  for (const inscripto of inscriptos) {
    if (cupoRestante.n <= 0) break

    // Reclamo atómico — mismo patrón que turnos.recordatorio_enviado en
    // /api/cron/recordatorios: si otra corrida ya lo marcó, el update no
    // afecta filas y se salta sin reenviar.
    const { data: reclamado, error: errReclamo } = await supabase
      .from('inscripciones_webinar')
      .update({ [flagColumna]: new Date().toISOString() })
      .eq('id', inscripto.id)
      .is(flagColumna, null)
      .select('id')

    if (errReclamo) {
      console.error(`[cron/webinars] Error al reclamar inscripción ${inscripto.id} (${tipo})`, errReclamo.message)
      continue
    }
    if (!reclamado?.length) continue

    cupoRestante.n--

    try {
      const base = {
        nombre: inscripto.nombre_apellido,
        titulo: webinar.titulo,
        fecha_inicio: webinar.fecha_inicio,
        duracion_min: webinar.duracion_min,
        url_videoconferencia: webinar.url_videoconferencia,
        urlAgendar: urlGoogleCalendar(webinar),
      }

      const html = tipo === 'recordatorio_1d' ? emailRecordatorio1dWebinar(base)
        : tipo === 'recordatorio_30m' ? emailRecordatorio30mWebinar(base)
        : emailPostEventoWebinar({ nombre: inscripto.nombre_apellido, titulo: webinar.titulo, slug: webinar.slug })

      const asunto = tipo === 'recordatorio_1d' ? `Mañana — ${webinar.titulo}`
        : tipo === 'recordatorio_30m' ? `${webinar.titulo} empieza en 30 minutos`
        : `Gracias por participar — ${webinar.titulo}`

      await enviarEmail({
        destinatario: inscripto.email,
        nombreDestinatario: inscripto.nombre_apellido,
        asunto,
        htmlContent: html,
      })
      enviados++
    } catch (err) {
      console.error(`[cron/webinars] Error enviando ${tipo} a inscripción ${inscripto.id}`, (err as Error)?.message)
      // Revertir el reclamo para que la próxima corrida reintente.
      await supabase.from('inscripciones_webinar').update({ [flagColumna]: null }).eq('id', inscripto.id)
      fallidos++
    }
  }

  return { enviados, fallidos }
}

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const ahora = new Date()

  const { data: webinars } = await supabase
    .from('webinars')
    .select('id, slug, titulo, fecha_inicio, duracion_min, url_videoconferencia')
    .eq('estado', 'publicado')

  const contadores: Record<TipoRecordatorio, { enviados: number; fallidos: number }> = {
    recordatorio_1d: { enviados: 0, fallidos: 0 },
    recordatorio_30m: { enviados: 0, fallidos: 0 },
    postevento: { enviados: 0, fallidos: 0 },
  }

  const cupoRestante = { n: MAX_ENVIOS_POR_CORRIDA }

  for (const webinar of (webinars ?? []) as WebinarRow[]) {
    if (cupoRestante.n <= 0) break

    const inicioMs = new Date(webinar.fecha_inicio).getTime()
    const finMs = inicioMs + webinar.duracion_min * MIN_MS
    const ahoraMs = ahora.getTime()

    // ── recordatorio_1d ──────────────────────────────────────────────
    if (ahoraMs >= inicioMs - 24 * HORA_MS && ahoraMs < inicioMs - 60 * MIN_MS) {
      const corteCreatedAt = new Date(inicioMs - 24 * HORA_MS).toISOString()
      const { data: inscriptos } = await supabase
        .from('inscripciones_webinar')
        .select('id, nombre_apellido, email')
        .eq('webinar_id', webinar.id)
        .is('recordatorio_1d_enviado_at', null)
        .lte('created_at', corteCreatedAt)

      if (inscriptos?.length) {
        const r = await procesarTipo(supabase, 'recordatorio_1d', webinar, inscriptos, cupoRestante)
        contadores.recordatorio_1d.enviados += r.enviados
        contadores.recordatorio_1d.fallidos += r.fallidos
      }
    }

    if (cupoRestante.n <= 0) break

    // ── recordatorio_30m ─────────────────────────────────────────────
    if (ahoraMs >= inicioMs - 30 * MIN_MS && ahoraMs < inicioMs) {
      const corteCreatedAt = new Date(inicioMs - 30 * MIN_MS).toISOString()
      const { data: inscriptos } = await supabase
        .from('inscripciones_webinar')
        .select('id, nombre_apellido, email')
        .eq('webinar_id', webinar.id)
        .is('recordatorio_30m_enviado_at', null)
        .lte('created_at', corteCreatedAt)

      if (inscriptos?.length) {
        const r = await procesarTipo(supabase, 'recordatorio_30m', webinar, inscriptos, cupoRestante)
        contadores.recordatorio_30m.enviados += r.enviados
        contadores.recordatorio_30m.fallidos += r.fallidos
      }
    }

    if (cupoRestante.n <= 0) break

    // ── postevento ───────────────────────────────────────────────────
    const inicioVentanaPost = finMs + 15 * MIN_MS
    const finVentanaPost = inicioVentanaPost + 24 * HORA_MS
    if (ahoraMs >= inicioVentanaPost && ahoraMs < finVentanaPost) {
      const { data: inscriptos } = await supabase
        .from('inscripciones_webinar')
        .select('id, nombre_apellido, email')
        .eq('webinar_id', webinar.id)
        .is('postevento_enviado_at', null)

      if (inscriptos?.length) {
        const r = await procesarTipo(supabase, 'postevento', webinar, inscriptos, cupoRestante)
        contadores.postevento.enviados += r.enviados
        contadores.postevento.fallidos += r.fallidos
      }
    }
  }

  return NextResponse.json({ ok: true, timestamp: ahora.toISOString(), ...contadores })
}
