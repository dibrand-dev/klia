import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailRecordatorioTurno } from '@/lib/email-templates'
import { ventanaDiaSiguienteAR } from '@/lib/tz'
import { verificarCron } from '@/lib/cron-auth'
import { whatsappDb, normalizarTelefonoAR, resolverPhoneNumberId, enviarTemplateRecordatorio } from '@/lib/whatsapp'
import { puedeUsarWhatsApp } from '@/lib/modulos'
import { hayCupoWhatsapp, CUPOS_RECORDATORIOS_MES, CUPO_TRIAL } from '@/lib/whatsapp-cupos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PacienteTurno = { nombre: string; apellido: string; email: string | null; telefono: string | null; whatsapp_opt_in: boolean }
type TerapeutaTurno = { nombre: string; apellido: string; especialidad: string | null; plan: string | null; estado_cuenta: string | null; trial_inicio: string | null }
type TurnoRecordatorio = {
  id: string
  fecha_hora: string
  duracion_min: number | null
  modalidad: string | null
  meet_link: string | null
  token_accion: string
  terapeuta_id: string
  paciente_id: string
  recordatorio_whatsapp_enviado: boolean
  paciente: PacienteTurno | null
  terapeuta: TerapeutaTurno | null
}

function formatearFechaHoraAR(fechaHoraISO: string): { fecha: string; hora: string } {
  const fechaHora = new Date(fechaHoraISO)
  const fecha = fechaHora.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const hora = fechaHora.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }) + ' hs'
  return { fecha, hora }
}

// Canal mail — misma lógica exacta que tenía este archivo antes de agregar
// WhatsApp (reclamo atómico sobre recordatorio_enviado, revert si el envío
// falla), solo extraída a función para poder correr ambos canales por turno
// sin que el `continue` de uno salte el otro.
async function procesarMail(
  supabase: SupabaseClient,
  turno: TurnoRecordatorio,
  APP_URL: string,
): Promise<{ resultado: 'enviado' | 'fallido' | 'omitido'; error?: string }> {
  const paciente = turno.paciente
  const terapeuta = turno.terapeuta

  if (!paciente?.email) {
    return { resultado: 'fallido', error: `turno ${turno.id}: paciente sin email` }
  }
  if (!terapeuta?.nombre) {
    return { resultado: 'fallido', error: `turno ${turno.id}: terapeuta sin datos` }
  }

  // Reclamo atómico: solo se envía si este turno sigue pendiente/confirmado
  // y nadie más (otra corrida en paralelo, o este mismo cron reintentado)
  // ya lo marcó. Si la fila no matchea (ya reclamado, o cancelado entre el
  // SELECT de arriba y este punto), se descarta sin mandar nada.
  const { data: reclamado, error: errReclamo } = await supabase
    .from('turnos')
    .update({ recordatorio_enviado: true })
    .eq('id', turno.id)
    .eq('recordatorio_enviado', false)
    .in('estado', ['pendiente', 'confirmado'])
    .select('id')

  if (errReclamo) {
    console.error('[cron/recordatorios] Error al reclamar turno', turno.id, errReclamo)
    return { resultado: 'fallido', error: `turno ${turno.id}: ${errReclamo.message}` }
  }

  if (!reclamado || reclamado.length === 0) {
    return { resultado: 'omitido' }
  }

  try {
    const { fecha, hora } = formatearFechaHoraAR(turno.fecha_hora)

    const pacienteNombre = `${paciente.nombre} ${paciente.apellido}`
    const profesionalNombre = `${terapeuta.nombre} ${terapeuta.apellido}`

    const html = emailRecordatorioTurno({
      pacienteNombre,
      profesionalNombre,
      profesionalEspecialidad: terapeuta?.especialidad ?? '',
      fecha,
      hora,
      duracion: turno.duracion_min ?? 50,
      modalidad: turno.modalidad ?? 'presencial',
      meetLink: turno.meet_link,
      confirmarUrl: `${APP_URL}/turno/${turno.token_accion}?accion=confirmar`,
      cancelarUrl: `${APP_URL}/turno/${turno.token_accion}?accion=cancelar`,
    })

    await enviarEmail({
      destinatario: paciente.email,
      nombreDestinatario: pacienteNombre,
      asunto: `Recordatorio: tu sesión es mañana a las ${hora}`,
      htmlContent: html,
    })

    return { resultado: 'enviado' }
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message ?? JSON.stringify(err)

    // El turno quedó reclamado (recordatorio_enviado=true) pero el mail
    // nunca salió — se revierte para que la próxima corrida lo reintente.
    const { error: errRevertir } = await supabase
      .from('turnos')
      .update({ recordatorio_enviado: false })
      .eq('id', turno.id)
    if (errRevertir) {
      console.error('[cron/recordatorios] Error al revertir reclamo del turno', turno.id, errRevertir)
    }

    return { resultado: 'fallido', error: `turno ${turno.id}: ${errorMsg}` }
  }
}

// Canal WhatsApp — propio flag (recordatorio_whatsapp_enviado) y propio
// reclamo atómico, totalmente independiente del canal mail. 'no_aplica' no
// es un fallo (paciente sin opt-in, módulo no habilitado, token no
// configurado, o cupo mensual agotado): no genera fila en whatsapp_mensajes
// ni cuenta como fallido.
async function procesarWhatsapp(
  supabase: SupabaseClient,
  turno: TurnoRecordatorio,
  cupoCache: Map<string, number>,
): Promise<{ resultado: 'enviado' | 'fallido' | 'omitido' | 'no_aplica'; error?: string; motivo?: string }> {
  const paciente = turno.paciente
  const terapeuta = turno.terapeuta

  if (!paciente?.whatsapp_opt_in) return { resultado: 'no_aplica' }
  if (!process.env.WHATSAPP_TOKEN) return { resultado: 'no_aplica' }

  const habilitado = await puedeUsarWhatsApp(supabase, turno.terapeuta_id)
  if (!habilitado) return { resultado: 'no_aplica' }

  const plan = terapeuta?.plan ?? ''
  const estadoCuenta = terapeuta?.estado_cuenta ?? null
  const trialInicio = terapeuta?.trial_inicio ?? null
  const tieneCupo = await hayCupoWhatsapp(supabase, turno.terapeuta_id, plan, estadoCuenta, trialInicio, cupoCache)
  if (!tieneCupo) {
    console.warn('[cron/recordatorios] Cupo de WhatsApp excedido', {
      profesional_id: turno.terapeuta_id,
      plan,
      estado_cuenta: estadoCuenta,
      cupo: estadoCuenta === 'trial' ? CUPO_TRIAL : (CUPOS_RECORDATORIOS_MES[plan] ?? 0),
    })
    return { resultado: 'no_aplica', motivo: 'cupo_excedido' }
  }

  const telefonoNormalizado = normalizarTelefonoAR(paciente.telefono)
  if (!telefonoNormalizado) {
    await supabase.from('whatsapp_mensajes').insert({
      turno_id: turno.id,
      paciente_id: turno.paciente_id,
      profesional_id: turno.terapeuta_id,
      tipo: 'recordatorio',
      telefono: paciente.telefono ?? '',
      estado: 'fallido',
      error: 'telefono_invalido',
    })
    return { resultado: 'fallido', error: 'telefono_invalido' }
  }

  // Reclamo atómico, igual criterio que el canal mail pero sobre su propio
  // flag — un turno puede mandar mail y WhatsApp, o solo uno de los dos,
  // sin que el reclamo de un canal bloquee al otro.
  const { data: reclamado, error: errReclamo } = await supabase
    .from('turnos')
    .update({ recordatorio_whatsapp_enviado: true })
    .eq('id', turno.id)
    .eq('recordatorio_whatsapp_enviado', false)
    .in('estado', ['pendiente', 'confirmado'])
    .select('id')

  if (errReclamo) {
    console.error('[cron/recordatorios] Error al reclamar turno (WhatsApp)', turno.id, errReclamo)
    return { resultado: 'fallido', error: errReclamo.message }
  }
  if (!reclamado || reclamado.length === 0) {
    return { resultado: 'omitido' }
  }

  const phoneNumberId = await resolverPhoneNumberId(turno.terapeuta_id)
  if (!phoneNumberId) {
    await supabase.from('turnos').update({ recordatorio_whatsapp_enviado: false }).eq('id', turno.id)
    return { resultado: 'fallido', error: 'sin_phone_number_id' }
  }

  const { fecha, hora } = formatearFechaHoraAR(turno.fecha_hora)
  const pacienteNombre = `${paciente.nombre} ${paciente.apellido}`
  const profesionalNombre = `${terapeuta?.nombre ?? ''} ${terapeuta?.apellido ?? ''}`.trim()

  try {
    const waMessageId = await enviarTemplateRecordatorio({
      to: telefonoNormalizado,
      phoneNumberId,
      params: [pacienteNombre, profesionalNombre, fecha, hora],
      tokenAccion: turno.token_accion,
    })

    await supabase.from('whatsapp_mensajes').insert({
      turno_id: turno.id,
      paciente_id: turno.paciente_id,
      profesional_id: turno.terapeuta_id,
      tipo: 'recordatorio',
      telefono: telefonoNormalizado,
      estado: 'enviando',
      wa_message_id: waMessageId,
    })

    cupoCache.set(turno.terapeuta_id, (cupoCache.get(turno.terapeuta_id) ?? 0) + 1)

    return { resultado: 'enviado' }
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message ?? JSON.stringify(err)

    await supabase.from('whatsapp_mensajes').insert({
      turno_id: turno.id,
      paciente_id: turno.paciente_id,
      profesional_id: turno.terapeuta_id,
      tipo: 'recordatorio',
      telefono: telefonoNormalizado,
      estado: 'fallido',
      error: errorMsg,
    })

    // Mismo criterio que el canal mail: se revierte el reclamo para que la
    // próxima corrida lo reintente.
    await supabase.from('turnos').update({ recordatorio_whatsapp_enviado: false }).eq('id', turno.id)

    return { resultado: 'fallido', error: errorMsg }
  }
}

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // whatsappDb() en vez de serviceClient(): mismo cliente service_role (mismo
  // fetch cache:'no-store'), re-tipeado porque el select de abajo trae
  // columnas (whatsapp_opt_in, recordatorio_whatsapp_enviado, etc.) que
  // todavía no están en los tipos generados de Supabase.
  const supabase = whatsappDb()

  const { desde, hasta } = ventanaDiaSiguienteAR()

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

  const { data: turnos, error } = await supabase
    .from('turnos')
    .select(`
      id, fecha_hora, duracion_min, modalidad, meet_link, token_accion, terapeuta_id, paciente_id, recordatorio_whatsapp_enviado,
      paciente:pacientes(nombre, apellido, email, telefono, whatsapp_opt_in),
      terapeuta:profiles(nombre, apellido, especialidad, plan, estado_cuenta, trial_inicio)
    `)
    .gte('fecha_hora', desde.toISOString())
    .lte('fecha_hora', hasta.toISOString())
    .eq('recordatorio_enviado', false)
    .in('estado', ['confirmado', 'pendiente'])

  if (error) {
    console.error('[cron/recordatorios] Error fetching turnos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let enviados = 0
  let fallidos = 0
  let omitidos = 0
  const errores: string[] = []

  let enviadosWhatsapp = 0
  let fallidosWhatsapp = 0
  let omitidosWhatsapp = 0
  let cupoExcedidoWhatsapp = 0
  const erroresWhatsapp: string[] = []

  // Map<profesional_id, recordatorios usados este mes> — una sola corrida
  // de este cron, se comparte entre todos los turnos para no recontar en
  // Supabase por cada uno. Ver src/lib/whatsapp-cupos.ts.
  const cupoCache = new Map<string, number>()

  for (const turno of (turnos ?? []) as unknown as TurnoRecordatorio[]) {
    const rMail = await procesarMail(supabase, turno, APP_URL)
    if (rMail.resultado === 'enviado') enviados++
    else if (rMail.resultado === 'fallido') { fallidos++; if (rMail.error) errores.push(rMail.error) }
    else omitidos++

    // El canal WhatsApp corre siempre, sin importar cómo salió el mail — un
    // fallo de un canal nunca corta ni condiciona al otro.
    const rWa = await procesarWhatsapp(supabase, turno, cupoCache)
    if (rWa.resultado === 'enviado') enviadosWhatsapp++
    else if (rWa.resultado === 'fallido') { fallidosWhatsapp++; if (rWa.error) erroresWhatsapp.push(`turno ${turno.id}: ${rWa.error}`) }
    else if (rWa.resultado === 'omitido') omitidosWhatsapp++
    else if (rWa.resultado === 'no_aplica' && rWa.motivo === 'cupo_excedido') cupoExcedidoWhatsapp++
    // Resto de 'no_aplica' no se cuenta: ni éxito ni fallo, el paciente/cuenta no es elegible para este canal.
  }

  return NextResponse.json({
    ok: true,
    enviados,
    fallidos,
    omitidos,
    total: turnos?.length ?? 0,
    timestamp: new Date().toISOString(),
    errores,
    whatsapp: {
      enviados: enviadosWhatsapp,
      fallidos: fallidosWhatsapp,
      omitidos: omitidosWhatsapp,
      cupo_excedido: cupoExcedidoWhatsapp,
      errores: erroresWhatsapp,
    },
    sample: turnos?.[0] ? {
      id: turnos[0].id,
      tienePaciente: !!(turnos[0].paciente),
      tieneTerapeuta: !!(turnos[0].terapeuta),
      pacienteEmail: (turnos[0].paciente as unknown as { email?: string })?.email ?? null,
    } : null,
  })
}
