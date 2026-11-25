import { NextRequest, NextResponse } from 'next/server'
import { format, parseISO } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { finalizarReservaConfirmada } from '@/lib/booking/finalizar-reserva'
import { resolverTipoReserva } from '@/lib/booking/resolver-tipo'
import { isSlotAvailable } from '@/lib/booking/slot-disponible'
import { normalizarEmail, normalizarNombre, normalizarDni, escaparIlike, elegirPacienteExistente } from '@/lib/pacientes/duplicados'
import { validarDniReserva, validarFechaNacimientoReserva } from '@/lib/booking/validar-datos-reserva'
import { ARGENTINA_TZ } from '@/lib/timezone'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TREINTA_MIN_MS = 30 * 60 * 1000

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
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
    dni?: string
    fecha_nacimiento?: string
    cobertura_id?: string
    sede_id?: string
    tipo_turno_id?: string
    whatsapp_opt_in?: boolean
  }

  const { slug, fecha, hora, tipo, modalidad, nombre, apellido, email, telefono, dni, fecha_nacimiento: fechaNacimiento, cobertura_id: coberturaId, sede_id: sedeId, tipo_turno_id: tipoTurnoId, whatsapp_opt_in: whatsappOptIn } = body

  if (!slug || !fecha || !hora || !tipo || !nombre || !apellido || !email) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const db = serviceClient()

  // 1. Get professional
  const { data: profile } = await db
    .from('profiles')
    .select('id, plan, nombre, apellido, especialidad, booking_duracion_sesion, booking_duracion_entrevista, booking_tiempo_entre, booking_anticipacion_minutos, booking_precio_sesion, booking_precio_entrevista, booking_sesion_visible, booking_entrevista_visible, booking_moneda, booking_activo, booking_requiere_pago, booking_requiere_dni, booking_requiere_fecha_nacimiento, mp_access_token, mp_public_key, agenda_hora_inicio, agenda_hora_fin, transferencia_banco, transferencia_alias, transferencia_titular')
    .eq('booking_slug', slug)
    .single()

  if (!profile || !profile.booking_activo) {
    return NextResponse.json({ error: 'Perfil no disponible' }, { status: 404 })
  }

  // Validación server-side de DNI/fecha de nacimiento — nunca confiar en el
  // cliente, aunque el flag esté apagado del lado del form.
  let dniValidado: string | null = null
  if (profile.booking_requiere_dni && !dni) {
    return NextResponse.json({ error: 'El DNI es obligatorio' }, { status: 400 })
  }
  if (dni) {
    dniValidado = validarDniReserva(dni)
    if (!dniValidado) {
      return NextResponse.json({ error: 'DNI inválido' }, { status: 400 })
    }
  }

  let fechaNacValidada: string | null = null
  if (profile.booking_requiere_fecha_nacimiento && !fechaNacimiento) {
    return NextResponse.json({ error: 'La fecha de nacimiento es obligatoria' }, { status: 400 })
  }
  if (fechaNacimiento) {
    fechaNacValidada = validarFechaNacimientoReserva(fechaNacimiento)
    if (!fechaNacValidada) {
      return NextResponse.json({ error: 'Fecha de nacimiento inválida' }, { status: 400 })
    }
  }

  // Validar la sede ANTES de resolver el tipo — mismo criterio que
  // disponibilidad/route.ts. Una sede_id que no es una sucursal activa real
  // de este profesional se descarta (null) y nunca se persiste en el turno.
  let sedeValidadaId: string | null = null
  if (sedeId) {
    const { data: sedeValida } = await db
      .from('sucursales')
      .select('id')
      .eq('id', sedeId)
      .eq('terapeuta_id', profile.id)
      .eq('activo', true)
      .maybeSingle()
    sedeValidadaId = sedeValida?.id ?? null
  }

  const tipoResuelto = await resolverTipoReserva(db, profile, tipo, tipoTurnoId, sedeValidadaId)
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

  const fechaHoraLocal = `${fecha}T${hora}:00`
  const fechaHora = fromZonedTime(fechaHoraLocal, ARGENTINA_TZ).toISOString()
  const modalidadMap: Record<string, string> = { online: 'videollamada', presencial: 'presencial', videollamada: 'videollamada', telefonica: 'telefonica' }
  const modalidadDb = (modalidadMap[modalidad ?? ''] ?? 'presencial') as 'presencial' | 'videollamada' | 'telefonica'
  const tipoTurnoColumn = tipoResuelto.tipoTurnoId ? 'sesion' : (tipo === 'sesion' ? 'sesion' : 'entrevista')

  const tieneTransferencia = !!(profile.transferencia_banco && profile.transferencia_alias && profile.transferencia_titular)

  // Particular, con pago exigido y algún medio de pago disponible (MP o
  // transferencia) — el paciente y el turno se crean recién cuando el pago
  // se aprueba (crearReservaDesdePago), nunca acá. De Morgan de la condición
  // de abajo: cualquier otro caso (sin pago exigido, sin medio de pago, u
  // obra social) sigue el camino de siempre, sin cambios.
  const requierePagoYEsParticular = profile.booking_requiere_pago && !!precio && (!!profile.mp_access_token || tieneTransferencia) && esParticular

  if (requierePagoYEsParticular) {
    const hash = shortId()
    const expiraAt = new Date(Date.now() + TREINTA_MIN_MS).toISOString()

    const { error: reservaErr } = await db.from('reservas_pendientes_pago').insert({
      hash,
      terapeuta_id: profile.id,
      nombre,
      apellido,
      email: normalizarEmail(email),
      telefono: telefono ?? null,
      dni: dniValidado,
      fecha_nacimiento: fechaNacValidada,
      cobertura_id: coberturaId ?? null,
      whatsapp_opt_in: !!whatsappOptIn,
      fecha_hora: fechaHora,
      duracion_min: duracion,
      modalidad: modalidadDb,
      sucursal_id: sedeValidadaId,
      tipo_turno: tipoTurnoColumn,
      tipo_turno_id: tipoResuelto.tipoTurnoId,
      moneda,
      monto: precio,
      estado: 'pendiente',
      expira_at: expiraAt,
    })

    if (reservaErr) {
      console.error('[booking/crear] reservas_pendientes_pago insert error:', reservaErr)
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
    }

    return NextResponse.json({
      hash,
      preference_id: null,
      monto: precio,
      mp_public_key: null,
      confirmado: false,
    })
  }

  // ── Camino sin cambios: sin pago exigido, sin medio de pago disponible, u
  // obra social — el paciente y el turno se crean de una, como siempre. ──

  // 3. Find or create paciente — nunca crear uno nuevo si ya existe alguno con
  // este email para este profesional. .maybeSingle() rompía con 2+ filas
  // (profesional con varios pacientes que comparten email, ej. una familia) y
  // terminaba creando OTRO paciente en vez de reusar uno de los existentes.
  let pacienteId: string

  const emailNormalizado = normalizarEmail(email)!
  const { data: existentes } = await db
    .from('pacientes')
    .select('id, obra_social, nombre, apellido, activo, created_at, dni, fecha_nacimiento')
    .eq('terapeuta_id', profile.id)
    .ilike('email', escaparIlike(emailNormalizado))

  let existing = elegirPacienteExistente(existentes ?? [], nombre, apellido, dniValidado)

  // Sin match por email: si la reserva trae DNI, buscar en toda la cartera
  // del profesional por ese DNI (mismo patrón que /api/pacientes/verificar-duplicado).
  // Solo se reusa si además coincide nombre y apellido — si el nombre difiere,
  // se crea un paciente nuevo (podría ser otra persona, DNI mal tipeado o reusado).
  if (!existing && dniValidado) {
    const { data: porDni } = await db
      .from('pacientes')
      .select('id, obra_social, nombre, apellido, activo, created_at, dni, fecha_nacimiento')
      .eq('terapeuta_id', profile.id)
      .not('dni', 'is', null)

    const nombreBuscado = normalizarNombre(nombre)
    const apellidoBuscado = normalizarNombre(apellido)
    existing = (porDni ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .find((p) =>
        normalizarDni(p.dni) === dniValidado
        && normalizarNombre(p.nombre) === nombreBuscado
        && normalizarNombre(p.apellido) === apellidoBuscado
      ) ?? null
  }

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
    // Completar DNI/fecha de nacimiento solo si el paciente no los tenía ya
    // cargados — nunca pisar un dato existente con el de esta reserva.
    if (dniValidado && !existing.dni) {
      patch.dni = dniValidado
    }
    if (fechaNacValidada && !existing.fecha_nacimiento) {
      patch.fecha_nacimiento = fechaNacValidada
    }
    // Solo había pacientes inactivos con este email — se reusa el más antiguo
    // en vez de crear uno nuevo, reactivándolo.
    if (!existing.activo) {
      patch.activo = true
    }
    // Solo se escribe si vino marcado — no marcado no significa "retirar el
    // consentimiento", puede ser simplemente que esta reserva no lo pidió de
    // nuevo (ya lo dio antes el profesional desde la ficha, por ejemplo).
    if (whatsappOptIn) {
      patch.whatsapp_opt_in = true
      patch.whatsapp_opt_in_at = new Date().toISOString()
      patch.whatsapp_opt_in_origen = 'reserva_publica'
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
        dni: dniValidado,
        fecha_nacimiento: fechaNacValidada,
        activo: true,
        motivo_consulta: (!tipoResuelto.tipoTurnoId && tipo === 'entrevista') ? 'Entrevista inicial (reserva online)' : null,
        ...(!esParticular && osEncontrada ? { obra_social: osEncontrada.nombre, os_config_id: osEncontrada.id } : {}),
        ...(whatsappOptIn ? { whatsapp_opt_in: true, whatsapp_opt_in_at: new Date().toISOString(), whatsapp_opt_in_origen: 'reserva_publica' } : {}),
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
      sucursal_id: sedeValidadaId,
      notas: (!tipoResuelto.tipoTurnoId && tipo === 'entrevista') ? 'Entrevista inicial reservada online' : 'Reserva online',
      tipo_turno: tipoTurnoColumn,
      tipo_turno_id: tipoResuelto.tipoTurnoId,
    })
    .select('id')
    .single()

  if (turnoErr || !turno) {
    console.error('[booking/crear] turno insert error:', turnoErr)
    return NextResponse.json({ error: 'Error al crear turno' }, { status: 500 })
  }

  const hash = shortId()

  // Sin pago exigido, sin medio de pago disponible (ni MP ni transferencia),
  // o paciente eligió obra social → queda pendiente de confirmación manual del
  // profesional. El turno ya se creó como 'pendiente' en el insert de arriba.
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
