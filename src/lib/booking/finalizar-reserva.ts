import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Database } from '@/types/database'
import { enviarEmail } from '@/lib/brevo'
import { emailBookingConfirmacion } from '@/lib/email-templates'
import { sincronizarTurnoCreado } from '@/lib/sync-google-calendar'

function db() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type MedioPago = 'mercadopago' | 'transferencia' | 'sin_pago'
export type DatosPago = { monto: number; moneda: string; referencia: string } | null

// Sibling de sincronizarTurnoCreado (mismo patrón: busca todo lo que necesita
// por turnoId/terapeutaId, no recibe el turno ya cargado — cada función queda
// autocontenida para que finalizarReservaConfirmada pueda aislar sus fallos).
// meetLink llega ya resuelto por finalizarReservaConfirmada (viene de la sync
// de Calendar que corrió justo antes, en el mismo request) — no se relee acá.
async function enviarEmailConfirmacionTurno(
  turnoId: string,
  terapeutaId: string,
  medioPago: MedioPago,
  pago: DatosPago,
  meetLink: string | null,
) {
  const supabase = db()

  const [{ data: turno }, { data: profile }] = await Promise.all([
    supabase.from('turnos').select('*, paciente:pacientes(*)').eq('id', turnoId).single(),
    supabase.from('profiles').select('nombre, apellido, especialidad').eq('id', terapeutaId).single(),
  ])

  if (!turno || !profile) return
  const paciente = turno.paciente as Record<string, unknown> | null
  if (!paciente?.email) return

  const d = parseISO(turno.fecha_hora)
  const fechaFmt = format(d, "EEEE d 'de' MMMM yyyy", { locale: es })
  const horaFmt = format(d, 'HH:mm')
  const tipoLabel = turno.notas?.includes('Entrevista') ? 'Entrevista inicial' : 'Sesión'
  const asunto = `Reserva confirmada con ${profile.nombre} ${profile.apellido} — KLIA`

  const { messageId } = await enviarEmail({
    destinatario: paciente.email as string,
    nombreDestinatario: `${paciente.nombre as string} ${paciente.apellido as string}`,
    asunto,
    htmlContent: emailBookingConfirmacion({
      pacienteNombre: `${paciente.nombre as string} ${paciente.apellido as string}`,
      profesionalNombre: `${profile.nombre} ${profile.apellido}`,
      especialidad: profile.especialidad ?? '',
      tipo: tipoLabel,
      fecha: fechaFmt,
      hora: horaFmt,
      duracion: turno.duracion_min,
      modalidad: turno.modalidad,
      medioPago,
      monto: pago?.monto,
      moneda: pago?.moneda,
      referencia: pago?.referencia,
      meetLink,
    }),
  })

  // Logueo en email_log separado del envío en sí — mismo patrón defensivo que
  // bloquear-trials/route.ts: si el insert falla, no debe tumbar un mail que
  // ya salió con éxito.
  try {
    await supabase.from('email_log').insert({
      terapeuta_id: terapeutaId,
      tipo: 'confirmacion_turno',
      asunto,
      brevo_message_id: messageId,
      paciente_id: turno.paciente_id,
      turno_id: turnoId,
      destinatario_email: paciente.email as string,
    })
  } catch (err) {
    console.error('[enviarEmailConfirmacionTurno] error registrando email_log:', err)
  }
}

// Punto único de entrada para "un turno quedó confirmado" en los 3 caminos de
// booking público (crear sin pago, confirmar-transferencia, confirmar con MP).
// Secuencial a propósito, no Promise.allSettled: el email necesita el meetLink
// que produce la sync de Calendar, así que Calendar va primero. Cada mitad
// tiene su propio try/catch — si Calendar falla, el email se manda igual (sin
// meetLink, ya que el insert nunca se hizo). Nunca lanza: un fallo acá no debe
// romper la respuesta HTTP del endpoint que llama, que ya tiene el turno
// confirmado en la base.
export async function finalizarReservaConfirmada(
  turnoId: string,
  terapeutaId: string,
  medioPago: MedioPago,
  pago: DatosPago = null,
): Promise<{
  calendarSync: boolean
  emailEnviado: boolean
  googleEventId: string | null
  meetLink: string | null
}> {
  let calendarSync = false
  let googleEventId: string | null = null
  let meetLink: string | null = null

  try {
    const resultado = await sincronizarTurnoCreado(turnoId, terapeutaId)
    if (resultado) {
      googleEventId = resultado.googleEventId
      meetLink = resultado.meetLink
    }
    calendarSync = true
  } catch (err) {
    console.error('[finalizarReservaConfirmada] error sincronizando Google Calendar:', err)
  }

  let emailEnviado = false
  try {
    await enviarEmailConfirmacionTurno(turnoId, terapeutaId, medioPago, pago, meetLink)
    emailEnviado = true
  } catch (err) {
    console.error('[finalizarReservaConfirmada] error enviando email de confirmación:', err)
  }

  return {
    calendarSync,
    emailEnviado,
    googleEventId,
    meetLink,
  }
}
