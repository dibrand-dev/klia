import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addMinutes, format, parseISO } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { finalizarReservaConfirmada } from '@/lib/booking/finalizar-reserva'
import { resolverTipoReserva } from '@/lib/booking/resolver-tipo'
import { normalizarEmail, normalizarNombre } from '@/lib/pacientes/duplicados'
import { ARGENTINA_TZ, zonedDateArgentina } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

// Para usar el email como filtro ilike sin que %, _ o \ actúen como comodín/escape.
function escaparIlike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`)
}

async function isSlotAvailable(
  db: ReturnType<typeof serviceClient>,
  profileId: string,
  fecha: string,
  hora: string,
  duracion: number,
): Promise<boolean> {
  const slotStart = timeToMin(hora)
  const slotEnd = slotStart + duracion

  const dayStart = fromZonedTime(`${fecha}T00:00:00`, ARGENTINA_TZ).toISOString()
  const dayEnd = fromZonedTime(`${fecha}T23:59:59`, ARGENTINA_TZ).toISOString()

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
    const d = zonedDateArgentina(t.fecha_hora)
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
    cobertura_id?: string
    sede_id?: string
    tipo_turno_id?: string
  }

  const { slug, fecha, hora, tipo, modalidad, nombre, apellido, email, telefono, cobertura_id: coberturaId, sede_id: sedeId, tipo_turno_id: tipoTurnoId } = body

  if (!slug || !fecha || !hora || !tipo || !nombre || !apellido || !email) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const db = serviceClient()

  // 1. Get professional
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, plan, nombre, apellido, especialidad, booking_duracion_sesion, booking_duracion_entrevista, booking_tiempo_entre, booking_anticipacion_minutos, booking_precio_sesion, booking_precio_entrevista, booking_moneda, booking_activo, booking_requiere_pago, mp_access_token, mp_public_key, agenda_hora_inicio, agenda_hora_fin, transferencia_banco, transferencia_alias, transferencia_titular')
    .eq('booking_slug', slug)
    .single()

  if (!profile || !profile.booking_activo) {
    return NextResponse.json({ error: 'Perfil no disponible' }, { status: 404 })
  }

  const tipoResuelto = await resolverTipoReserva(db, profile, tipo, tipoTurnoId)
  if ('error' in tipoResuelto) {
    return NextResponse.json({ error: tipoResuelto.error }, { status: 400 })
  }

  const duracion: number = tipoResuelto.duracion
  const precio: number | null = tipoResuelto.precio
  const moneda = tipoResuelto.moneda

  // 2. Race condition check
  const slotOk = await isSlotAvailable(db, profile.id, fecha, hora, duracion)
  if (!slotOk) {
    return NextResponse.json({ error: 'slot_taken' }, { status: 409 })
  }

  // 2b. Obra social elegida — si no matchea una obra social activa del profesional, se trata como particular
  let osEncontrada: { id: string; nombre: string } | null = null
  if (coberturaId && coberturaId !== 'particular') {
    const { data: os } = await db
      .from('profesional_obras_sociales')
      .select('id, nombre')
      .eq('id', coberturaId)
      .eq('terapeuta_id', profile.id)
      .eq('activa', true)
      .maybeSingle()
    osEncontrada = os ?? null
  }
  const esParticular = !osEncontrada

  // 3. Find or create paciente — nunca crear uno nuevo si ya existe alguno con
  // este email para este profesional. .maybeSingle() rompía con 2+ filas
  // (profesional con varios pacientes que comparten email, ej. una familia) y
  // terminaba creando OTRO paciente en vez de reusar uno de los existentes.
  let pacienteId: string

  const emailNormalizado = normalizarEmail(email)!
  const { data: existentes } = await db
    .from('pacientes')
    .select('id, obra_social, nombre, apellido, activo, created_at')
    .eq('terapeuta_id', profile.id)
    .ilike('email', escaparIlike(emailNormalizado))

  // Prioridad: activo con nombre+apellido normalizados iguales > activo más
  // antiguo > (si no hay ningún activo) inactivo más antiguo, reactivándolo.
  const ordenados = (existentes ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
  const nombreBuscado = normalizarNombre(nombre)
  const apellidoBuscado = normalizarNombre(apellido)
  const activos = ordenados.filter((p) => p.activo)
  const existing =
    activos.find((p) => normalizarNombre(p.nombre) === nombreBuscado && normalizarNombre(p.apellido) === apellidoBuscado)
    ?? activos[0]
    ?? ordenados[0]
    ?? null

  if (existing) {
    pacienteId = existing.id
    // No se actualiza nombre/apellido a propósito — queda a criterio del profesional
    // corregirlo a mano si lo nota. Solo se deja trazabilidad en logs para medir
    // qué tan frecuente es el caso en producción real.
    if (existing.nombre !== nombre || existing.apellido !== apellido) {
      console.log('[booking/crear] Nombre tipeado difiere del guardado — paciente_id:', pacienteId,
        '| guardado:', existing.nombre, existing.apellido,
        '| tipeado en esta reserva:', nombre, apellido)
    }
    // No pisar una obra social ya cargada a mano por el profesional en la ficha del paciente.
    const patch: Record<string, unknown> = {}
    if (!esParticular && osEncontrada && !existing.obra_social) {
      patch.obra_social = osEncontrada.nombre
      patch.os_config_id = osEncontrada.id
    }
    // Solo había pacientes inactivos con este email — se reusa el más antiguo
    // en vez de crear uno nuevo, reactivándolo.
    if (!existing.activo) {
      patch.activo = true
    }
    if (Object.keys(patch).length > 0) {
      await db.from('pacientes').update(patch).eq('id', pacienteId)
    }
  } else {
    const { data: newPaciente, error: pacErr } = await db
      .from('pacientes')
      .insert({
        terapeuta_id: profile.id,
        nombre,
        apellido,
        email: emailNormalizado,
        telefono: telefono ?? null,
        activo: true,
        motivo_consulta: (!tipoResuelto.tipoTurnoId && tipo === 'entrevista') ? 'Entrevista inicial (reserva online)' : null,
        ...(!esParticular && osEncontrada ? { obra_social: osEncontrada.nombre, os_config_id: osEncontrada.id } : {}),
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
  const fechaHoraLocal = `${fecha}T${hora}:00`
  const fechaHora = fromZonedTime(fechaHoraLocal, ARGENTINA_TZ).toISOString()
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
      sucursal_id: sedeId ?? null,
      notas: (!tipoResuelto.tipoTurnoId && tipo === 'entrevista') ? 'Entrevista inicial reservada online' : 'Reserva online',
      tipo_turno: tipoResuelto.tipoTurnoId ? 'sesion' : (tipo === 'sesion' ? 'sesion' : 'entrevista'),
      tipo_turno_id: tipoResuelto.tipoTurnoId,
    })
    .select('id')
    .single()

  if (turnoErr || !turno) {
    console.error('[booking/crear] turno insert error:', turnoErr)
    return NextResponse.json({ error: 'Error al crear turno' }, { status: 500 })
  }

  const hash = shortId()

  const tieneTransferencia = !!(profile.transferencia_banco && profile.transferencia_alias && profile.transferencia_titular)

  // 5. If no payment required, no medio de pago disponible (ni MP ni transferencia),
  // or paciente eligió obra social → queda pendiente de confirmación manual del
  // profesional (solo un pago real por MP, o una transferencia confirmada a mano,
  // confirma automáticamente). El turno ya se creó como 'pendiente' en el insert de arriba.
  if (!profile.booking_requiere_pago || !precio || (!profile.mp_access_token && !tieneTransferencia) || !esParticular) {
    const { googleEventId, meetLink } = await finalizarReservaConfirmada(turno.id, profile.id, 'sin_pago', null)

    return NextResponse.json({
      hash,
      preference_id: null,
      monto: precio ?? 0,
      mp_public_key: null,
      confirmado: true,
      turno_id: turno.id,
      fecha_fmt: format(parseISO(fechaHoraLocal), "EEEE d 'de' MMMM yyyy"),
      hora,
      duracion,
      moneda,
      referencia: hash,
      google_event_id: googleEventId,
      meet_link: meetLink,
    })
  }

  // 6. Particular con precio, pago requerido y MP conectado — el paciente elige el
  // medio de pago en el paso siguiente (Mercado Pago vs. Transferencia). La preferencia
  // de MP se crea recién si elige esa opción, vía /api/booking/mp-preferencia.
  return NextResponse.json({
    hash,
    preference_id: null,
    monto: precio,
    mp_public_key: null,
    confirmado: false,
    turno_id: turno.id,
  })
}
