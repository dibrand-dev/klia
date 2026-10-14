import { NextRequest, NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/brevo'
import { emailPagoSesionVencida } from '@/lib/email-templates'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { zonedDateArgentina } from '@/lib/timezone'
import { verificarCron } from '@/lib/cron-auth'
import { serviceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()

  // Cutoff = start of today in Argentina (UTC-3, no DST).
  // Argentina midnight = 03:00 UTC of the same calendar date.
  // We only notify sessions that expired BEFORE today (Argentine calendar),
  // guaranteeing the email goes out the day AFTER the session expired.
  const nowUTC = new Date()
  const cutoff = new Date(nowUTC)
  cutoff.setUTCHours(3, 0, 0, 0)
  // If current UTC hour < 3 we're still in the previous AR day — go back one day
  if (nowUTC.getUTCHours() < 3) cutoff.setUTCDate(cutoff.getUTCDate() - 1)
  const cutoffISO = cutoff.toISOString()

  // Sessions that: are still pending AND expired before today (AR time).
  // Once a session is marked 'vencido' it never appears here again → exactly 1 email per session.
  const { data: vencidos } = await db
    .from('sesiones_pago')
    .select('*, turno:turnos(fecha_hora, duracion_min, modalidad, paciente:pacientes(nombre, apellido, email)), profesional:profiles!sesiones_pago_terapeuta_id_fkey(nombre, apellido)')
    .eq('estado', 'pendiente')
    .lt('vence_at', cutoffISO)

  if (!vencidos?.length) {
    return NextResponse.json({ ok: true, expired: 0, cutoff: cutoffISO })
  }

  const ids = vencidos.map(s => s.id)

  // Mark as vencido FIRST, pidiendo de vuelta los ids realmente actualizados
  // en el mismo round-trip. Si falla, abortamos — no se manda ningún mail,
  // evitando notificaciones duplicadas en la próxima corrida del cron.
  const { data: marcados, error: updateError } = await db.from('sesiones_pago')
    .update({ estado: 'vencido' })
    .in('id', ids)
    .select('id')

  if (updateError) {
    console.error('[vencer] Error al marcar sesiones como vencidas:', updateError)
    return NextResponse.json({ error: 'No se pudo actualizar sesiones_pago', detail: updateError.message }, { status: 500 })
  }

  // Solo las sesiones efectivamente marcadas 'vencido' en esta corrida se notifican.
  const idsConfirmados = new Set((marcados ?? []).map(s => s.id))
  const sesionesANotificar = vencidos.filter(s => idsConfirmados.has(s.id))

  // Cancelar el turno asociado solo si sigue pendiente y no está pagado —
  // un turno ya pagado (pago tardío que llegó antes de esta corrida) nunca se cancela.
  const turnoIds = sesionesANotificar.map(s => s.turno_id)
  if (turnoIds.length) {
    const { error: cancelError } = await db.from('turnos')
      .update({ estado: 'cancelado' })
      .in('id', turnoIds)
      .eq('estado', 'pendiente')
      .neq('estado_pago', 'pagado')
    if (cancelError) console.error('[vencer] Error al cancelar turnos vencidos:', cancelError)
  }

  // Send exactly 1 email per session, only for confirmed-vencido sessions
  let emailsSent = 0
  for (const sesion of sesionesANotificar) {
    const turno = sesion.turno as Record<string, unknown> | null
    const paciente = (turno?.paciente as Record<string, unknown> | null)
    const profesional = sesion.profesional as Record<string, unknown> | null

    if (!paciente?.email) continue

    try {
      const fecha = turno?.fecha_hora
        ? format(zonedDateArgentina(turno.fecha_hora as string), "EEEE d 'de' MMMM", { locale: es })
        : ''

      await enviarEmail({
        destinatario: paciente.email as string,
        nombreDestinatario: `${paciente.nombre as string} ${paciente.apellido as string}`,
        asunto: 'Tu reserva de sesión venció',
        htmlContent: emailPagoSesionVencida({
          pacienteNombre: `${paciente.nombre as string} ${paciente.apellido as string}`,
          profesionalNombre: `${profesional?.nombre as string} ${profesional?.apellido as string}`,
          fecha,
        }),
      })
      emailsSent++
    } catch (e) {
      console.error('[vencer] email error for sesion', sesion.id, e)
    }
  }

  return NextResponse.json({
    ok: true,
    cutoff: cutoffISO,
    encontradas: ids.length,
    notificadas: sesionesANotificar.length,
    emailsSent,
  })
}
