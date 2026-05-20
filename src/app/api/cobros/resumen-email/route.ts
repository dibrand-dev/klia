import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarEmail } from '@/lib/brevo'
import { emailResumenCobros } from '@/lib/email-templates'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { paciente_id, mes, anio } = await req.json() as {
    paciente_id: string
    mes: number  // 1-12
    anio: number
  }

  if (!paciente_id || !mes || !anio) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  // Fetch paciente
  const { data: paciente, error: pacienteError } = await supabase
    .from('pacientes')
    .select('nombre, apellido, email, cobrar_inasistencias, moneda_preferida')
    .eq('id', paciente_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (pacienteError || !paciente) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
  }

  if (!paciente.email) {
    return NextResponse.json({ error: 'El paciente no tiene email registrado' }, { status: 400 })
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, apellido, especialidad, email, cobrar_inasistencias')
    .eq('id', user.id)
    .single()

  // Compute month boundaries (Argentina UTC-3)
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0))
  const finMes = new Date(Date.UTC(anio, mes, 1, 3, 0, 0))

  // Fetch turnos for the month
  const { data: turnos } = await supabase
    .from('turnos')
    .select('id, fecha_hora, duracion_min, monto, moneda, estado, estado_pago, monto_pagado')
    .eq('paciente_id', paciente_id)
    .eq('terapeuta_id', user.id)
    .in('estado', ['realizado', 'no_asistio'])
    .gte('fecha_hora', inicioMes.toISOString())
    .lt('fecha_hora', finMes.toISOString())
    .order('fecha_hora')

  const cobrarInasistencias = paciente.cobrar_inasistencias ?? profile?.cobrar_inasistencias ?? false

  const turnosFiltrados = (turnos ?? []).filter(t => {
    if (t.estado === 'no_asistio' && !cobrarInasistencias) return false
    return true
  })

  const moneda = paciente.moneda_preferida || 'ARS'

  // Compute totals
  let totalMes = 0
  let yaAbonado = 0

  for (const t of turnosFiltrados) {
    if (t.estado_pago !== 'bonificado') {
      totalMes += t.monto ?? 0
      yaAbonado += t.monto_pagado ?? 0
    }
  }
  const saldoPendiente = Math.max(0, totalMes - yaAbonado)

  // Format sesiones for template
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const mesNombre = `${MESES[mes - 1]} ${anio}`

  const sesiones = turnosFiltrados.map(t => {
    const fecha = new Date(t.fecha_hora)
    // Adjust for Argentina UTC-3
    const fechaArg = new Date(fecha.getTime() - 3 * 60 * 60 * 1000)
    const dia = fechaArg.getUTCDate().toString().padStart(2, '0')
    const mesStr = (fechaArg.getUTCMonth() + 1).toString().padStart(2, '0')
    const fechaFormateada = `${dia}/${mesStr}/${anio}`
    return {
      fecha: fechaFormateada,
      duracion_min: t.duracion_min,
      monto: t.monto,
      moneda: t.moneda || moneda,
      estado_pago: t.estado_pago ?? 'pendiente',
    }
  })

  const profesionalNombre = profile ? `${profile.nombre} ${profile.apellido}` : 'Tu profesional'

  const html = emailResumenCobros({
    pacienteNombre: paciente.nombre,
    profesionalNombre,
    profesionalEspecialidad: profile?.especialidad ?? null,
    profesionalEmail: profile?.email ?? user.email ?? '',
    mes: mesNombre,
    sesiones,
    totalMes,
    yaAbonado,
    saldoPendiente,
    moneda,
  })

  await enviarEmail({
    destinatario: paciente.email,
    nombreDestinatario: `${paciente.nombre} ${paciente.apellido}`,
    asunto: `Resumen de sesiones — ${mesNombre}`,
    htmlContent: html,
  })

  return NextResponse.json({ ok: true })
}
