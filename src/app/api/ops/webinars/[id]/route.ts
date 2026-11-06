import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getAdminUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .single()
  return data ?? null
}

async function revalidarLanding() {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) return
  try {
    await fetch(`https://www.klia.com.ar/api/revalidate?secret=${secret}`, { method: 'POST' })
  } catch (err) {
    console.error('Error llamando a revalidate landing:', err)
  }
}

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

function datetimeLocalARaUTC(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const [, y, m, d, hh, mm] = match.map(Number) as unknown as number[]
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh) + 3, Number(mm), 0)).toISOString()
}

interface WebinarPayload {
  titulo?: unknown
  slug?: unknown
  bajada?: unknown
  institucion?: unknown
  imagen_url?: unknown
  fecha_inicio?: unknown
  duracion_min?: unknown
  cierre_inscripcion?: unknown
  url_videoconferencia?: unknown
  estado?: unknown
}

function validarPayload(body: WebinarPayload): { error: string } | {
  titulo: string
  slug: string
  bajada: string
  institucion: string | null
  imagen_url: string | null
  fecha_inicio: string
  duracion_min: number
  cierre_inscripcion: string
  url_videoconferencia: string
  estado: string
} {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
  if (titulo.length < 3 || titulo.length > 140) return { error: 'El título debe tener entre 3 y 140 caracteres.' }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!SLUG_REGEX.test(slug) || slug.length > 80) return { error: 'El slug no es válido (solo minúsculas, números y guiones).' }

  const bajada = typeof body.bajada === 'string' ? body.bajada.trim() : ''
  if (bajada.length < 3 || bajada.length > 1200) return { error: 'La bajada debe tener entre 3 y 1200 caracteres.' }

  const institucion = typeof body.institucion === 'string' && body.institucion.trim() ? body.institucion.trim() : null
  const imagen_url = typeof body.imagen_url === 'string' && body.imagen_url ? body.imagen_url : null

  const fecha_inicio = typeof body.fecha_inicio === 'string'
    ? (body.fecha_inicio.includes('T') && !body.fecha_inicio.endsWith('Z') && body.fecha_inicio.length <= 16
        ? datetimeLocalARaUTC(body.fecha_inicio)
        : body.fecha_inicio)
    : null
  if (!fecha_inicio) return { error: 'La fecha y hora de inicio no es válida.' }

  const duracion_min = Number(body.duracion_min)
  if (!Number.isFinite(duracion_min) || duracion_min < 5 || duracion_min > 600) {
    return { error: 'La duración debe estar entre 5 y 600 minutos.' }
  }

  const cierre_inscripcion = typeof body.cierre_inscripcion === 'string'
    ? (body.cierre_inscripcion.includes('T') && !body.cierre_inscripcion.endsWith('Z') && body.cierre_inscripcion.length <= 16
        ? datetimeLocalARaUTC(body.cierre_inscripcion)
        : body.cierre_inscripcion)
    : null
  if (!cierre_inscripcion) return { error: 'La fecha y hora de cierre de inscripción no es válida.' }
  if (new Date(cierre_inscripcion) > new Date(fecha_inicio)) {
    return { error: 'El cierre de inscripción no puede ser posterior al inicio.' }
  }

  const url_videoconferencia = typeof body.url_videoconferencia === 'string' ? body.url_videoconferencia.trim() : ''
  if (!/^https:\/\//i.test(url_videoconferencia)) return { error: 'La URL de la videoconferencia debe empezar con https://.' }

  const estado = typeof body.estado === 'string' ? body.estado : 'borrador'
  if (!['borrador', 'publicado', 'cancelado'].includes(estado)) return { error: 'Estado inválido.' }

  return { titulo, slug, bajada, institucion, imagen_url, fecha_inicio, duracion_min, cierre_inscripcion, url_videoconferencia, estado }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = serviceClient()

  const { data: actual } = await db.from('webinars').select('*').eq('id', params.id).single()
  if (!actual) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const body = await req.json() as WebinarPayload
  const merged: WebinarPayload = { ...actual, ...body }

  const validado = validarPayload(merged)
  if ('error' in validado) return NextResponse.json({ error: validado.error }, { status: 400 })

  if (validado.slug !== actual.slug) {
    const { data: existente } = await db.from('webinars').select('id').eq('slug', validado.slug).neq('id', params.id).maybeSingle()
    if (existente) return NextResponse.json({ error: 'Ya existe un webinar con ese slug.' }, { status: 409 })
  }

  const { error } = await db.from('webinars').update({ ...validado, updated_at: new Date().toISOString() }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await revalidarLanding()
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = serviceClient()

  const { count } = await db
    .from('inscripciones_webinar')
    .select('id', { count: 'exact', head: true })
    .eq('webinar_id', params.id)

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Este webinar tiene inscriptos — no se puede eliminar. Pasalo a "cancelado" en su lugar.' }, { status: 409 })
  }

  const { error } = await db.from('webinars').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await revalidarLanding()
  return NextResponse.json({ ok: true })
}
