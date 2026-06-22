import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailPagoSesionVencida } from '@/lib/email-templates'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Database } from '@/types/database'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  const auth = req.headers.get('authorization')
  if (!isVercelCron && auth !== `Bearer ${process.env.CRON_SECRET}`) {
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

  // Mark as vencido FIRST. If this fails we abort — no email is sent,
  // preventing duplicate notifications on the next cron run.
  const { error: updateError } = await db.from('sesiones_pago')
    .update({ estado: 'vencido' })
    .in('id', ids)

  if (updateError) {
    console.error('[vencer] Error al marcar sesiones como vencidas:', updateError)
    return NextResponse.json({ error: 'No se pudo actualizar sesiones_pago', detail: updateError.message }, { status: 500 })
  }

  // Verify the update actually persisted before sending any email.
  // Only sessions confirmed as 'vencido' in the DB get notified.
  const { data: confirmadas } = await db.from('sesiones_pago')
    .select('id')
    .eq('estado', 'vencido')
    .in('id', ids)

  const idsConfirmados = new Set((confirmadas ?? []).map(s => s.id))
  const sesionesANotificar = vencidos.filter(s => idsConfirmados.has(s.id))

  // Cancel the associated turnos
  const turnoIds = sesionesANotificar.map(s => s.turno_id)
  if (turnoIds.length) {
    await db.from('turnos').update({ estado: 'cancelado' }).in('id', turnoIds)
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
        ? format(parseISO(turno.fecha_hora as string), "EEEE d 'de' MMMM", { locale: es })
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
