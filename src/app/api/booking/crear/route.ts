import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseISO, addMinutes, format } from 'date-fns'
import { sincronizarTurnoCreado } from '@/lib/sync-google-calendar'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function pad(n: number) { return String(n).padStart(2, '0') }
function minToTime(m: number) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}` }

async function isSlotAvailable(
  db: ReturnType<typeof serviceClient>,
  profileId: string,
  fecha: string,
  hora: string,
  duracion: number,
): Promise<boolean> {
  const slotStart = timeToMin(hora)
  const slotEnd = slotStart + duracion

  const dayStart = `${fecha}T00:00:00`
  const dayEnd = `${fecha}T23:59:59`

  const [{ data: turnos }, { data: entrevistas }] = await Promise.all([
    db.from('turnos')
      .select('fecha_hora, duracion_min')
      .eq('terapeuta_id', profileId)
      .gte('fecha_hora', dayStart)
      .lte('fecha_hora', dayEnd)
      .not('estado', 'in', '("cancelado")'),
    db.from('entrevistas')
      .select('hora, duracion')
      .eq('terapeuta_id', profileId)
      .eq('fecha', fecha)
      .not('estado', 'in', '("cancelada")'),
  ])

  for (const t of turnos ?? []) {
    const d = parseISO(t.fecha_hora)
    const oStart = d.getHours() * 60 + d.getMinutes()
    const oEnd = oStart + (t.duracion_min ?? duracion)
    if (slotStart < oEnd && slotEnd > oStart) return false
  }

  for (const e of entrevistas ?? []) {
    const oStart = timeToMin(e.hora)
    const oEnd = oStart + (e.duracion ?? 30)
    if (slotStart < oEnd && slotEnd > oStart) return false
  }

  return true
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    slug?: string
    fecha?: string
    hora?: string
    tipo?: string
    modalidad?: string
    nombre?: string
    apellido?: string
    email?: string
    telefono?: string
  }

  const { slug, fecha, hora, tipo, modalidad, nombre, apellido, email, telefono } = body

  if (!slug || !fecha || !hora || !tipo || !nombre || !apellido || !email) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const db = serviceClient()

  // 1. Get professional
  const { data: profile } = await db
    .from('profiles')
    .select('id, nombre, apellido, especialidad, booking_duracion_sesion, booking_duracion_entrevista, booking_tiempo_entre, booking_anticipacion_minutos, booking_precio_sesion, booking_precio_entrevista, booking_moneda, booking_activo, booking_requiere_pago, mp_access_token, mp_public_key, agenda_hora_inicio, agenda_hora_fin')
    .eq('booking_slug', slug)
    .single()

  if (!profile || !profile.booking_activo) {
    return NextResponse.json({ error: 'Perfil no disponible' }, { status: 404 })
  }

  const duracion: number = tipo === 'sesion'
    ? (profile.booking_duracion_sesion ?? 50)
    : (profile.booking_duracion_entrevista ?? 30)

  const precio: number | null = tipo === 'sesion'
    ? profile.booking_precio_sesion
    : profile.booking_precio_entrevista

  const moneda = profile.booking_moneda ?? 'ARS'

  // 2. Race condition check
  const slotOk = await isSlotAvailable(db, profile.id, fecha, hora, duracion)
  if (!slotOk) {
    return NextResponse.json({ error: 'slot_taken' }, { status: 409 })
  }

  // 3. Find or create paciente
  let pacienteId: string

  const { data: existing } = await db
    .from('pacientes')
    .select('id')
    .eq('terapeuta_id', profile.id)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    pacienteId = existing.id
  } else {
    const { data: newPaciente, error: pacErr } = await db
      .from('pacientes')
      .insert({
        terapeuta_id: profile.id,
        nombre,
        apellido,
        email,
        telefono: telefono ?? null,
        activo: true,
        motivo_consulta: tipo === 'entrevista' ? 'Entrevista inicial (reserva online)' : null,
      })
      .select('id')
      .single()

    if (pacErr || !newPaciente) {
      console.error('[booking/crear] paciente insert error:', pacErr)
      return NextResponse.json({ error: 'Error al registrar paciente' }, { status: 500 })
    }
    pacienteId = newPaciente.id
  }

  // 4. Create turno
  const fechaHora = `${fecha}T${hora}:00`
  const modalidadMap: Record<string, string> = { online: 'videollamada', presencial: 'presencial', videollamada: 'videollamada', telefonica: 'telefonica' }
  const modalidadDb = (modalidadMap[modalidad ?? ''] ?? 'presencial') as 'presencial' | 'videollamada' | 'telefonica'

  const { data: turno, error: turnoErr } = await db
    .from('turnos')
    .insert({
      terapeuta_id: profile.id,
      paciente_id: pacienteId,
      fecha_hora: fechaHora,
      duracion_min: duracion,
      modalidad: modalidadDb,
      estado: 'pendiente' as const,
      monto: precio ?? null,
      moneda,
      notas: tipo === 'entrevista' ? 'Entrevista inicial reservada online' : 'Reserva online',
    })
    .select('id')
    .single()

  if (turnoErr || !turno) {
    console.error('[booking/crear] turno insert error:', turnoErr)
    return NextResponse.json({ error: 'Error al crear turno' }, { status: 500 })
  }

  const hash = shortId()

  // 5. If no payment required or no MP connected → confirm immediately
  if (!profile.booking_requiere_pago || !precio || !profile.mp_access_token) {
    await db.from('turnos').update({ estado: 'confirmado' }).eq('id', turno.id)

    try {
      await sincronizarTurnoCreado(turno.id, profile.id)
    } catch { /* non-critical — GCal sync failure must not break booking */ }

    return NextResponse.json({
      hash,
      preference_id: null,
      monto: precio ?? 0,
      mp_public_key: null,
      confirmado: true,
      turno_id: turno.id,
      fecha_fmt: format(parseISO(fechaHora), "EEEE d 'de' MMMM yyyy"),
      hora,
      duracion,
      moneda,
      referencia: hash,
    })
  }

  // 6. Create MP preference
  const venceAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

  const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${profile.mp_access_token}`,
    },
    body: JSON.stringify({
      items: [{
        title: `${tipo === 'sesion' ? 'Sesión' : 'Entrevista inicial'} con ${profile.nombre} ${profile.apellido}`,
        quantity: 1,
        unit_price: precio,
        currency_id: moneda,
      }],
      payer: { email },
      back_urls: {
        success: `${appUrl}/p/${slug}?status=success&hash=${hash}`,
        failure: `${appUrl}/p/${slug}?status=failure&hash=${hash}`,
        pending: `${appUrl}/p/${slug}?status=pending&hash=${hash}`,
      },
      auto_return: 'approved',
      notification_url: `${appUrl}/api/pagos/webhook`,
      metadata: { hash, turno_id: turno.id, terapeuta_id: profile.id, booking: true },
      statement_descriptor: 'KLIA TURNO',
      expires: true,
      expiration_date_to: venceAt,
    }),
  })

  if (!prefRes.ok) {
    const errText = await prefRes.text()
    console.error('[booking/crear] MP preference error:', errText)
    // Still create sesion_pago without preference
    await db.from('sesiones_pago').insert({
      turno_id: turno.id,
      terapeuta_id: profile.id,
      paciente_id: pacienteId,
      hash,
      monto: precio,
      moneda,
      vence_at: venceAt,
    })
    return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 502 })
  }

  const pref = await prefRes.json() as { id: string }

  // 7. Create sesion_pago
  await db.from('sesiones_pago').insert({
    turno_id: turno.id,
    terapeuta_id: profile.id,
    paciente_id: pacienteId,
    hash,
    monto: precio,
    moneda,
    mp_preference_id: pref.id,
    vence_at: venceAt,
  })

  return NextResponse.json({
    hash,
    preference_id: pref.id,
    monto: precio,
    mp_public_key: profile.mp_public_key,
    confirmado: false,
    turno_id: turno.id,
  })
}
