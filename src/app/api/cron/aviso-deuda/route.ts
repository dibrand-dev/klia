import { NextRequest, NextResponse } from 'next/server'
import { generarEmailAvisoDeuda } from '@/lib/emails/aviso-deuda'
import { enviarEmail } from '@/lib/brevo'
import { verificarCron } from '@/lib/cron-auth'
import { serviceClient } from '@/lib/supabase/service'
import { calcularFinSesion, calcularFechaAvisoDeuda, type AvisoDeudaTiming } from '@/lib/avisoDeuda'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// KL1-T39 — disponible solo en estos planes (Esencial queda afuera).
const PLANES_HABILITADOS = ['profesional', 'premium', 'bonificado']

type TurnoCandidato = {
  id: string
  paciente_id: string
  fecha_hora: string
  duracion_min: number
  fin_real_at: string | null
  monto: number | null
  monto_pagado: number | null
  moneda: string
  estado_pago: string | null
  paciente: { os_config_id: string | null } | null
}

export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const ahora = new Date()

  const { data: terapeutas } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, especialidad, email, telefono, matricula, matricula_tipo, matricula_provincia, plan, aviso_deuda_timing')
    .neq('aviso_deuda_timing', 'nunca')
    .in('plan', PLANES_HABILITADOS)

  if (!terapeutas?.length) {
    return NextResponse.json({ ok: true, enviados: 0 })
  }

  let enviados = 0

  for (const terapeuta of terapeutas) {
    const timing = terapeuta.aviso_deuda_timing as AvisoDeudaTiming

    // Candidatas: realizada, no pagada del todo, sin aviso previo. El filtro
    // particular/obra social y bonificada/saldo real se resuelve abajo en JS
    // (os_config_id vive en pacientes, no en turnos).
    const { data } = await supabase
      .from('turnos')
      .select('id, paciente_id, fecha_hora, duracion_min, fin_real_at, monto, monto_pagado, moneda, estado_pago, paciente:pacientes(os_config_id)')
      .eq('terapeuta_id', terapeuta.id)
      .eq('estado', 'realizado')
      .eq('pagado', false)
      .eq('aviso_deuda_enviado', false)

    const turnos = (data ?? []) as unknown as TurnoCandidato[]
    if (!turnos.length) continue

    const pacientesCache = new Map<string, { nombre: string; apellido: string; email: string | null }>()

    for (const turno of turnos) {
      if (turno.paciente?.os_config_id) continue // obra social, no particular
      if (turno.estado_pago === 'bonificado') continue

      const saldoPendiente = (turno.monto ?? 0) - Math.min(turno.monto_pagado ?? 0, turno.monto ?? 0)
      if (saldoPendiente <= 0) continue

      const finSesion = calcularFinSesion(turno)
      const fechaAviso = calcularFechaAvisoDeuda(finSesion, timing)
      if (!fechaAviso || fechaAviso > ahora) continue

      // Reclamo atómico — mismo patrón que recordatorio_enviado: si otra
      // corrida ya lo marcó, el update no afecta filas y se salta sin reenviar.
      const { data: reclamado } = await supabase
        .from('turnos')
        .update({ aviso_deuda_enviado: true })
        .eq('id', turno.id)
        .eq('aviso_deuda_enviado', false)
        .select('id')

      if (!reclamado?.length) continue

      let paciente = pacientesCache.get(turno.paciente_id)
      if (!paciente) {
        const { data: pacienteData } = await supabase
          .from('pacientes')
          .select('nombre, apellido, email')
          .eq('id', turno.paciente_id)
          .single()
        if (pacienteData) {
          paciente = pacienteData
          pacientesCache.set(turno.paciente_id, pacienteData)
        }
      }

      if (!paciente?.email) continue

      const matriculaFormateada = terapeuta.matricula
        ? `${terapeuta.matricula_tipo === 'nacional' ? 'MN' : 'MP'} ${terapeuta.matricula}${terapeuta.matricula_provincia ? ` (${terapeuta.matricula_provincia})` : ''}`
        : null

      const html = generarEmailAvisoDeuda({
        pacienteNombre: `${paciente.nombre} ${paciente.apellido}`,
        profesionalNombre: `${terapeuta.nombre} ${terapeuta.apellido}`,
        profesionalEspecialidad: terapeuta.especialidad ?? '',
        profesionalMatricula: matriculaFormateada,
        profesionalEmail: terapeuta.email,
        profesionalTelefono: terapeuta.telefono,
        sesiones: [{
          fecha: new Date(turno.fecha_hora).toLocaleDateString('es-AR'),
          descripcion: 'Sesión',
          monto: turno.monto ?? 0,
          moneda: turno.moneda ?? 'ARS',
        }],
        monedaTotal: turno.moneda ?? 'ARS',
      })

      try {
        await enviarEmail({
          destinatario: paciente.email,
          nombreDestinatario: `${paciente.nombre} ${paciente.apellido}`,
          asunto: `Recordatorio de sesión pendiente — ${terapeuta.nombre} ${terapeuta.apellido}`,
          htmlContent: html,
        })
        enviados++
      } catch (err) {
        console.error('[cron/aviso-deuda] Error enviando a', paciente.email, err)
        // Revertir el reclamo para poder reintentar en la próxima corrida.
        await supabase.from('turnos').update({ aviso_deuda_enviado: false }).eq('id', turno.id)
      }
    }
  }

  return NextResponse.json({ ok: true, enviados })
}
