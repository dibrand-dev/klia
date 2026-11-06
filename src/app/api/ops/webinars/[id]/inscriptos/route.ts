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

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = serviceClient()

  const { data: inscriptos, error } = await db
    .from('inscripciones_webinar')
    .select('*')
    .eq('webinar_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const formato = req.nextUrl.searchParams.get('format')

  if (formato !== 'csv') {
    return NextResponse.json({ inscriptos: inscriptos ?? [] })
  }

  const headers = [
    'nombre_apellido', 'email', 'telefono', 'especialidad', 'institucion', 'fecha_inscripcion',
    'q1', 'q2', 'q2txt', 'q3', 'q3txt', 'q4', 'utm_source', 'utm_campaign',
  ]

  const filas = (inscriptos ?? []).map((i) => {
    const r = (i.respuestas as Record<string, unknown>) ?? {}
    const utm = (i.utm as Record<string, unknown>) ?? {}
    const fechaAR = new Date(i.created_at).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    return [
      i.nombre_apellido, i.email, i.telefono, i.especialidad, i.institucion ?? '', fechaAR,
      r.q1 ?? '', r.q2 ?? '', r.q2txt ?? '', Array.isArray(r.q3) ? (r.q3 as string[]).join('; ') : '', r.q3txt ?? '', r.q4 ?? '',
      utm.utm_source ?? '', utm.utm_campaign ?? '',
    ].map(csvEscape).join(',')
  })

  const csv = '﻿' + [headers.join(','), ...filas].join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inscriptos-${params.id}.csv"`,
    },
  })
}
