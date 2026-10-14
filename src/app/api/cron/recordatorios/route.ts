import { NextRequest, NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/brevo'
import { emailRecordatorioTurno } from '@/lib/email-templates'
import { ventanaDiaSiguienteAR } from '@/lib/tz'
import { verificarCron } from '@/lib/cron-auth'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()

  const { desde, hasta } = ventanaDiaSiguienteAR()

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

  const { data: turnos, error } = await supabase
    .from('turnos')
    .select(`
      id, fecha_hora, duracion_min, modalidad, meet_link, token_accion,
      paciente:pacientes(nombre, apellido, email),
      terapeuta:profiles(nombre, apellido, especialidad)
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

  for (const turno of turnos ?? []) {
    const paciente = turno.paciente as unknown as { nombre: string; apellido: string; email: string | null } | null
    const terapeuta = turno.terapeuta as unknown as { nombre: string; apellido: string; especialidad: string | null } | null

    if (!paciente?.email) {
      errores.push(`turno ${turno.id}: paciente sin email`)
      fallidos++
      continue
    }

    if (!terapeuta?.nombre) {
      errores.push(`turno ${turno.id}: terapeuta sin datos`)
      fallidos++
      continue
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
      errores.push(`turno ${turno.id}: ${errReclamo.message}`)
      fallidos++
      continue
    }

    if (!reclamado || reclamado.length === 0) {
      omitidos++
      continue
    }

    try {
      const fechaHora = new Date(turno.fecha_hora)
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

      const pacienteNombre = `${paciente.nombre} ${paciente.apellido}`
      const profesionalNombre = terapeuta ? `${terapeuta.nombre} ${terapeuta.apellido}` : ''

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

      enviados++
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message ?? JSON.stringify(err)
      errores.push(`turno ${turno.id}: ${errorMsg}`)
      fallidos++

      // El turno quedó reclamado (recordatorio_enviado=true) pero el mail
      // nunca salió — se revierte para que la próxima corrida lo reintente.
      const { error: errRevertir } = await supabase
        .from('turnos')
        .update({ recordatorio_enviado: false })
        .eq('id', turno.id)
      if (errRevertir) {
        console.error('[cron/recordatorios] Error al revertir reclamo del turno', turno.id, errRevertir)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    enviados,
    fallidos,
    omitidos,
    total: turnos?.length ?? 0,
    timestamp: new Date().toISOString(),
    errores,
    sample: turnos?.[0] ? {
      id: turnos[0].id,
      tienePaciente: !!(turnos[0].paciente),
      tieneTerapeuta: !!(turnos[0].terapeuta),
      pacienteEmail: (turnos[0].paciente as unknown as { email?: string })?.email ?? null,
    } : null,
  })
}
