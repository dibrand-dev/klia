import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { enviarEmail } from '@/lib/brevo'
import { emailTurnoTransferenciaVencido } from '@/lib/email-templates'
import { sincronizarTurnoCancelado } from '@/lib/sync-google-calendar'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  const nowISO = new Date().toISOString()

  // Turnos por transferencia sin confirmar a tiempo. estado='pendiente' es la
  // guarda natural contra falsos positivos: cualquier transición de estado (MP
  // aprobado, confirmación manual del profesional desde Agenda, cancelación)
  // saca al turno de este filtro sin que este cron necesite saberlo.
  const { data: vencidos, error: fetchError } = await db
    .from('turnos')
    .select('id, terapeuta_id, fecha_hora, paciente:pacientes(nombre, apellido, email)')
    .eq('estado', 'pendiente')
    .not('vence_en', 'is', null)
    .lt('vence_en', nowISO)

  if (fetchError) {
    console.error('[cron/vencer-turnos-transferencia] Error buscando turnos:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!vencidos?.length) {
    return NextResponse.json({ ok: true, encontrados: 0, timestamp: nowISO })
  }

  const ids = vencidos.map(t => t.id)

  // Marcar cancelado PRIMERO. Si falla, se aborta sin notificar — evita
  // duplicar avisos en la próxima corrida del cron. Mismo patrón defensivo
  // que /api/pagos/vencer.
  const { error: updateError } = await db
    .from('turnos')
    .update({ estado: 'cancelado', motivo_cancelacion: 'Vencido sin confirmar pago por transferencia' })
    .in('id', ids)

  if (updateError) {
    console.error('[cron/vencer-turnos-transferencia] Error al cancelar turnos:', updateError)
    return NextResponse.json({ error: 'No se pudo actualizar turnos', detail: updateError.message }, { status: 500 })
  }

  // Releer para confirmar que la cancelación persistió antes de notificar —
  // solo se procesan (sync Calendar + email) los turnos confirmados como cancelados.
  const { data: confirmados } = await db
    .from('turnos')
    .select('id')
    .eq('estado', 'cancelado')
    .in('id', ids)

  const idsConfirmados = new Set((confirmados ?? []).map(t => t.id))
  const turnosANotificar = vencidos.filter(t => idsConfirmados.has(t.id))

  const terapeutaIds = Array.from(new Set(turnosANotificar.map(t => t.terapeuta_id)))
  const { data: profesionales } = await db
    .from('profiles')
    .select('id, nombre, apellido, booking_slug')
    .in('id', terapeutaIds)

  const profesionalPorId = new Map((profesionales ?? []).map(p => [p.id, p]))

  let calendarSyncs = 0
  let emailsEnviados = 0
  const errores: string[] = []

  for (const turno of turnosANotificar) {
    try {
      await sincronizarTurnoCancelado(turno.id, turno.terapeuta_id)
      calendarSyncs++
    } catch (err) {
      const msg = (err as Error)?.message ?? JSON.stringify(err)
      errores.push(`turno ${turno.id} sync Calendar → ${msg}`)
    }

    const paciente = turno.paciente as unknown as { nombre: string; apellido: string; email: string | null } | null
    if (!paciente?.email) continue

    const profesional = profesionalPorId.get(turno.terapeuta_id)
    if (!profesional) continue

    try {
      const fecha = format(parseISO(turno.fecha_hora), "EEEE d 'de' MMMM", { locale: es })
      await enviarEmail({
        destinatario: paciente.email,
        nombreDestinatario: `${paciente.nombre} ${paciente.apellido}`,
        asunto: `Tu reserva con ${profesional.nombre} ${profesional.apellido} venció`,
        htmlContent: emailTurnoTransferenciaVencido({
          pacienteNombre: `${paciente.nombre} ${paciente.apellido}`,
          profesionalNombre: `${profesional.nombre} ${profesional.apellido}`,
          fecha,
          bookingSlug: profesional.booking_slug,
        }),
      })
      emailsEnviados++
    } catch (err) {
      const msg = (err as Error)?.message ?? JSON.stringify(err)
      errores.push(`turno ${turno.id} email → ${msg}`)
    }
  }

  return NextResponse.json({
    ok: true,
    encontrados: ids.length,
    cancelados: turnosANotificar.length,
    calendarSyncs,
    emailsEnviados,
    errores,
    timestamp: nowISO,
  })
}
