import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { enviarEmail } from '@/lib/brevo'
import { emailRecordatorioTurno } from '@/lib/email-templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  const auth = req.headers.get('authorization')
  if (!isVercelCron && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const mananaAR = new Date(ahoraAR)
  mananaAR.setDate(mananaAR.getDate() + 1)

  const desdeAR = new Date(mananaAR)
  desdeAR.setHours(0, 0, 0, 0)

  const hastaAR = new Date(mananaAR)
  hastaAR.setHours(23, 59, 59, 999)

  const desde = desdeAR
  const hasta = hastaAR

  const { data: turnos, error } = await supabase
    .from('turnos')
    .select(`
      id, fecha_hora, duracion_min, modalidad, meet_link,
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

  for (const turno of turnos ?? []) {
    try {
      const paciente = turno.paciente as unknown as { nombre: string; apellido: string; email: string | null } | null
      const terapeuta = turno.terapeuta as unknown as { nombre: string; apellido: string; especialidad: string | null } | null

      if (!paciente?.email) {
        fallidos++
        continue
      }

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
      })

      await enviarEmail({
        destinatario: paciente.email,
        nombreDestinatario: pacienteNombre,
        asunto: `Recordatorio: tu sesión es mañana a las ${hora}`,
        htmlContent: html,
      })

      await supabase
        .from('turnos')
        .update({ recordatorio_enviado: true })
        .eq('id', turno.id)

      enviados++
    } catch (err) {
      console.error(`[cron/recordatorios] Error en turno ${turno.id}:`, err)
      console.error('[cron/recordatorios] Paciente email:', (turno.paciente as unknown as { email?: string })?.email)
      console.error('[cron/recordatorios] Error detail:', JSON.stringify(err, Object.getOwnPropertyNames(err)))
      fallidos++
    }
  }

  return NextResponse.json({
    ok: true,
    enviados,
    fallidos,
    total: turnos?.length ?? 0,
    timestamp: new Date().toISOString(),
  })
}
