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
  const now = new Date().toISOString()

  // Find all pending payments that have expired
  const { data: vencidos } = await db
    .from('sesiones_pago')
    .select('*, turno:turnos(fecha_hora, duracion_min, modalidad, paciente:pacientes(nombre, apellido, email)), profesional:profiles!sesiones_pago_terapeuta_id_fkey(nombre, apellido)')
    .eq('estado', 'pendiente')
    .lt('vence_at', now)

  if (!vencidos?.length) {
    return NextResponse.json({ ok: true, expired: 0 })
  }

  const ids = vencidos.map(s => s.id)

  // Bulk update sesiones_pago — critical: if this fails, skip emails to avoid repeat notifications
  const { error: updateError } = await db.from('sesiones_pago')
    .update({ estado: 'vencido' })
    .in('id', ids)

  if (updateError) {
    console.error('[vencer] Error al marcar sesiones como vencidas:', updateError)
    return NextResponse.json({ error: 'No se pudo actualizar sesiones_pago', detail: updateError.message }, { status: 500 })
  }

  // Verify update actually worked — only email sessions that are now vencido
  const { data: realmenterVencidos } = await db.from('sesiones_pago')
    .select('id')
    .eq('estado', 'vencido')
    .in('id', ids)

  const idsActualizados = new Set((realmenterVencidos ?? []).map(s => s.id))
  const sesionesANotificar = vencidos.filter(s => idsActualizados.has(s.id))

  // Bulk update turnos to cancelado
  const turnoIds = sesionesANotificar.map(s => s.turno_id)
  if (turnoIds.length) {
    await db.from('turnos').update({ estado: 'cancelado' }).in('id', turnoIds)
  }

  // Send expiry emails only for sessions successfully marked as vencido
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

  return NextResponse.json({ ok: true, expired: ids.length, notificadas: sesionesANotificar.length, emailsSent })
}
