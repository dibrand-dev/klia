import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generarEmailAvisoDeuda } from '@/lib/emails/aviso-deuda'
import { enviarEmail } from '@/lib/brevo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  const auth = req.headers.get('authorization')
  if (!isVercelCron && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: terapeutas } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, especialidad, email, telefono, matricula, matricula_tipo, matricula_provincia')
    .eq('aviso_deuda_activo', true)

  if (!terapeutas?.length) {
    return NextResponse.json({ ok: true, enviados: 0 })
  }

  // Rango: ayer 00:00 - 23:59 en AR
  const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const ayerAR = new Date(ahoraAR)
  ayerAR.setDate(ayerAR.getDate() - 1)
  const ayerDesde = new Date(ayerAR); ayerDesde.setHours(0, 0, 0, 0)
  const ayerHasta = new Date(ayerAR); ayerHasta.setHours(23, 59, 59, 999)
  const hoyStr = ahoraAR.toISOString().split('T')[0]

  let enviados = 0

  for (const terapeuta of terapeutas) {
    // Buscar turnos realizados ayer sin pagar
    const { data: turnosAyer } = await supabase
      .from('turnos')
      .select('paciente_id')
      .eq('terapeuta_id', terapeuta.id)
      .gte('fecha_hora', ayerDesde.toISOString())
      .lte('fecha_hora', ayerHasta.toISOString())
      .eq('estado', 'realizado')
      .eq('pagado', false)

    if (!turnosAyer?.length) continue

    // Pacientes únicos con sesión ayer sin pagar
    const pacientesIds = Array.from(new Set(turnosAyer.map(t => t.paciente_id)))

    for (const pacienteId of pacientesIds) {
      // Verificar que no se envió aviso hoy ya
      const { data: yaEnviado } = await supabase
        .from('avisos_deuda_enviados')
        .select('id')
        .eq('terapeuta_id', terapeuta.id)
        .eq('paciente_id', pacienteId)
        .gte('enviado_at', `${hoyStr}T00:00:00`)
        .maybeSingle()

      if (yaEnviado) continue

      // Traer datos del paciente
      const { data: paciente } = await supabase
        .from('pacientes')
        .select('nombre, apellido, email')
        .eq('id', pacienteId)
        .single()

      if (!paciente?.email) continue

      // Traer TODAS las sesiones impagas del paciente (historial completo)
      const { data: todasImpagas } = await supabase
        .from('turnos')
        .select('id, fecha_hora, monto, moneda')
        .eq('terapeuta_id', terapeuta.id)
        .eq('paciente_id', pacienteId)
        .eq('estado', 'realizado')
        .eq('pagado', false)
        .order('fecha_hora', { ascending: true })

      if (!todasImpagas?.length) continue

      const matriculaFormateada = terapeuta.matricula
        ? `${(terapeuta as Record<string, unknown>).matricula_tipo === 'nacional' ? 'MN' : 'MP'} ${terapeuta.matricula}${(terapeuta as Record<string, unknown>).matricula_provincia ? ` (${(terapeuta as Record<string, unknown>).matricula_provincia})` : ''}`
        : null

      const sesiones = todasImpagas.map(t => ({
        fecha: new Date(t.fecha_hora).toLocaleDateString('es-AR'),
        descripcion: 'Sesión',
        monto: t.monto ?? 0,
        moneda: (t as Record<string, unknown>).moneda as string ?? 'ARS',
      }))

      const monedaTotal = sesiones[0]?.moneda ?? 'ARS'

      const html = generarEmailAvisoDeuda({
        pacienteNombre: `${paciente.nombre} ${paciente.apellido}`,
        profesionalNombre: `${terapeuta.nombre} ${terapeuta.apellido}`,
        profesionalEspecialidad: terapeuta.especialidad ?? '',
        profesionalMatricula: matriculaFormateada,
        profesionalEmail: terapeuta.email,
        profesionalTelefono: terapeuta.telefono,
        sesiones,
        monedaTotal,
      })

      try {
        await enviarEmail({
          destinatario: paciente.email,
          nombreDestinatario: `${paciente.nombre} ${paciente.apellido}`,
          asunto: `Recordatorio de sesiones pendientes — ${terapeuta.nombre} ${terapeuta.apellido}`,
          htmlContent: html,
        })

        await supabase.from('avisos_deuda_enviados').insert({
          terapeuta_id: terapeuta.id,
          paciente_id: pacienteId,
          turno_ids: todasImpagas.map(t => t.id),
        })

        enviados++
      } catch (err) {
        console.error('[cron/aviso-deuda] Error enviando a', paciente.email, err)
      }
    }
  }

  return NextResponse.json({ ok: true, enviados })
}
