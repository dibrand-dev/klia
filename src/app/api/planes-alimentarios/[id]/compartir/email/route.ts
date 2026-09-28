import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { enviarEmail } from '@/lib/brevo'
import { emailPlanAlimentarioCompartido } from '@/lib/email-templates'
import { formatNombreCompleto } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const { data: plan } = await db
    .from('planes_alimentarios')
    .select('id, nombre, paciente_id')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const body = await request.json()
  const email = String(body?.email ?? '').trim()
  const asunto = String(body?.asunto ?? `Tu plan alimentario — ${plan.nombre}`).trim()
  const mensaje = String(body?.mensaje ?? '').trim()
  const guardarEnFicha = !!body?.guardar_en_ficha

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const [{ data: activo }, { data: paciente }, { data: profile }] = await Promise.all([
    db
      .from('plan_compartidos')
      .select('id, token')
      .eq('plan_id', params.id)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .is('revocado_en', null)
      .maybeSingle(),
    db.from('pacientes').select('id, nombre, apellido, email').eq('id', plan.paciente_id).single(),
    db.from('profiles').select('nombre, apellido, email').eq('id', efectivo.terapeutaId).single(),
  ])

  if (!activo) return NextResponse.json({ error: 'No hay un link activo para este plan' }, { status: 400 })
  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'
  const planUrl = `${appUrl}/p/plan/${activo.token}`

  try {
    await enviarEmail({
      destinatario: email,
      nombreDestinatario: formatNombreCompleto(paciente.nombre, paciente.apellido),
      asunto,
      htmlContent: emailPlanAlimentarioCompartido({
        pacienteNombre: paciente.nombre,
        profesionalNombre: profile ? formatNombreCompleto(profile.nombre, profile.apellido) : 'tu profesional',
        planUrl,
        mensajePersonalizado: mensaje,
      }),
      ...(profile?.email ? { replyTo: { email: profile.email, name: formatNombreCompleto(profile.nombre, profile.apellido) } } : {}),
    })
  } catch (err) {
    console.error('[compartir/email] Error al enviar email:', err)
    return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 })
  }

  const ahora = new Date().toISOString()
  await db.from('plan_compartidos').update({ enviado_a: email, enviado_en: ahora }).eq('id', activo.id)

  if (guardarEnFicha && !paciente.email) {
    await db.from('pacientes').update({ email }).eq('id', paciente.id)
  }

  return NextResponse.json({ ok: true, enviado_a: email, enviado_en: ahora })
}
