import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseISO, addMinutes, format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function pad(n: number) { return String(n).padStart(2, '0') }
function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minToTime(m: number) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}` }

async function getAvailableSlots(
  slug: string,
  fecha: string,  // YYYY-MM-DD
  tipo: string,
): Promise<string[]> {
  const db = serviceClient()

  const { data: profile } = await db
    .from('profiles')
    .select('id, agenda_hora_inicio, agenda_hora_fin, booking_duracion_sesion, booking_duracion_entrevista, booking_tiempo_entre, booking_anticipacion_minutos, booking_activo')
    .eq('booking_slug', slug)
    .single()

  if (!profile || !profile.booking_activo) return []

  const duracion: number = tipo === 'sesion'
    ? (profile.booking_duracion_sesion ?? 50)
    : (profile.booking_duracion_entrevista ?? 30)
  const buffer: number = profile.booking_tiempo_entre ?? 10
  const interval = duracion + buffer
  const anticipacion: number = profile.booking_anticipacion_minutos ?? 60

  const startMin = (profile.agenda_hora_inicio ?? 9) * 60
  const endMin = (profile.agenda_hora_fin ?? 20) * 60

  // Generate all possible slots
  const allSlots: string[] = []
  for (let t = startMin; t + duracion <= endMin; t += interval) {
    allSlots.push(minToTime(t))
  }

  // Filter past slots (if today)
  const nowMin = (() => {
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')
    if (todayStr !== fecha) return -1
    return now.getHours() * 60 + now.getMinutes() + anticipacion
  })()

  const futureSlots = nowMin >= 0
    ? allSlots.filter(s => timeToMin(s) > nowMin)
    : allSlots

  if (futureSlots.length === 0) return []

  // Get occupied turnos for this day
  const dayStart = `${fecha}T00:00:00`
  const dayEnd = `${fecha}T23:59:59`

  const [{ data: turnos }, { data: entrevistas }] = await Promise.all([
    db.from('turnos')
      .select('fecha_hora, duracion_min')
      .eq('terapeuta_id', profile.id)
      .gte('fecha_hora', dayStart)
      .lte('fecha_hora', dayEnd)
      .not('estado', 'in', '("cancelado")'),
    db.from('entrevistas')
      .select('hora, duracion')
      .eq('terapeuta_id', profile.id)
      .eq('fecha', fecha)
      .not('estado', 'in', '("cancelada")'),
  ])

  // Build occupied intervals [startMin, endMin]
  const occupied: Array<[number, number]> = []

  for (const t of turnos ?? []) {
    const d = parseISO(t.fecha_hora)
    const slotStart = d.getHours() * 60 + d.getMinutes()
    occupied.push([slotStart, slotStart + (t.duracion_min ?? duracion)])
  }
  for (const e of entrevistas ?? []) {
    const slotStart = timeToMin(e.hora)
    occupied.push([slotStart, slotStart + (e.duracion ?? 30)])
  }

  // Filter out overlapping slots
  const available = futureSlots.filter(slotTime => {
    const sStart = timeToMin(slotTime)
    const sEnd = sStart + duracion
    return !occupied.some(([oStart, oEnd]) => sStart < oEnd && sEnd > oStart)
  })

  return available
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug') ?? ''
  const fecha = searchParams.get('fecha') ?? ''
  const tipo = searchParams.get('tipo') ?? 'sesion'
  const view = searchParams.get('view') ?? 'dia'

  if (!slug || !fecha) {
    return NextResponse.json({ error: 'slug y fecha requeridos' }, { status: 400 })
  }

  // Month view: YYYY-MM
  if (view === 'mes') {
    const [y, m] = fecha.split('-').map(Number)
    if (!y || !m) return NextResponse.json({ availableDays: [] })

    const daysInMonth = new Date(y, m, 0).getDate()
    const today = new Date()
    const todayDateStr = format(today, 'yyyy-MM-dd')

    const results = await Promise.all(
      Array.from({ length: daysInMonth }, (_, i) => i + 1).map(async (day) => {
        const dayStr = `${y}-${pad(m)}-${pad(day)}`
        if (dayStr < todayDateStr) return null
        const slots = await getAvailableSlots(slug, dayStr, tipo)
        return slots.length > 0 ? day : null
      })
    )

    return NextResponse.json({ availableDays: results.filter(Boolean) })
  }

  // Day view: YYYY-MM-DD
  const slots = await getAvailableSlots(slug, fecha, tipo)
  return NextResponse.json({ slots })
}
