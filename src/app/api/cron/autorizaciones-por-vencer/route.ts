import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { enviarEmail } from '@/lib/brevo'
import { emailAutorizacionesPorVencer } from '@/lib/email-templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dayWindow(daysFromNow: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

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

  // Ventana acotada a un solo día (hoy + 7), igual patrón que bloquear-trials —
  // evita que el mismo paciente dispare el email varios días seguidos.
  const { start, end } = dayWindow(7)
  const startStr = start.toISOString().slice(0, 10)
  const endStr = end.toISOString().slice(0, 10)
  const { data: pacientes, error } = await supabase
    .from('pacientes')
    .select('id, nombre, apellido, terapeuta_id, autorizacion_vigencia_hasta')
    .eq('activo', true)
    .gte('autorizacion_vigencia_hasta', startStr)
    .lte('autorizacion_vigencia_hasta', endStr)

  if (error) {
    console.error('[cron/autorizaciones-por-vencer] Error buscando pacientes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Agrupar pacientes por profesional dueño — un solo email por profesional
  // aunque tenga varios pacientes venciendo el mismo día.
  const porTerapeuta = new Map<string, { nombre: string; fecha: string }[]>()
  for (const p of pacientes ?? []) {
    const lista = porTerapeuta.get(p.terapeuta_id) ?? []
    lista.push({
      nombre: `${p.nombre} ${p.apellido}`,
      fecha: new Date(p.autorizacion_vigencia_hasta + 'T00:00:00').toLocaleDateString('es-AR'),
    })
    porTerapeuta.set(p.terapeuta_id, lista)
  }

  let emailsEnviados = 0
  const errores: string[] = []

  for (const [terapeutaId, listaPacientes] of Array.from(porTerapeuta.entries())) {
    const { data: profesional } = await supabase
      .from('profiles')
      .select('nombre, email')
      .eq('id', terapeutaId)
      .single()

    const { data: colaboradoras } = await supabase
      .from('colaboradores')
      .select('colaborador_id')
      .eq('profesional_id', terapeutaId)
      .eq('activo', true)
      .eq('invitacion_aceptada', true)

    const colaboradorIds = (colaboradoras ?? []).map((c) => c.colaborador_id)
    const { data: perfilesColaboradoras } = colaboradorIds.length > 0
      ? await supabase.from('profiles').select('nombre, email').in('id', colaboradorIds)
      : { data: [] }

    const destinatarios = [
      ...(profesional ? [profesional] : []),
      ...(perfilesColaboradoras ?? []),
    ].filter((d) => !!d.email)

    for (const destinatario of destinatarios) {
      try {
        await enviarEmail({
          destinatario: destinatario.email!,
          nombreDestinatario: destinatario.nombre ?? destinatario.email!,
          asunto: listaPacientes.length === 1
            ? 'Una autorización de obra social vence en 7 días'
            : 'Autorizaciones de obra social por vencer',
          htmlContent: emailAutorizacionesPorVencer(destinatario.nombre ?? destinatario.email!, listaPacientes),
        })
        emailsEnviados++
      } catch (err) {
        const errorMsg = (err as Error)?.message ?? JSON.stringify(err)
        errores.push(`terapeuta ${terapeutaId} → ${destinatario.email}: ${errorMsg}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    pacientesEncontrados: pacientes?.length ?? 0,
    profesionalesNotificados: porTerapeuta.size,
    emailsEnviados,
    errores,
    timestamp: new Date().toISOString(),
  })
}
