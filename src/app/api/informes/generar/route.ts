import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Database } from '@/types/database'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export const runtime = 'nodejs'

function svc() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function fmtFecha(d: string) {
  try { return format(parseISO(d), "d 'de' MMMM 'de' yyyy", { locale: es }) }
  catch { return d }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    paciente_id: string
    tipo_solicitud: string
    diagnostico_cie10_codigo?: string
    diagnostico_cie10_descripcion?: string
    periodo_desde: string
    periodo_hasta: string
    observaciones_profesional?: string
  }

  const { paciente_id, tipo_solicitud, diagnostico_cie10_codigo, diagnostico_cie10_descripcion, periodo_desde, periodo_hasta, observaciones_profesional } = body

  if (!paciente_id || !tipo_solicitud || !periodo_desde || !periodo_hasta) {
    return NextResponse.json({ error: 'Faltan parámetros obligatorios' }, { status: 400 })
  }

  const db = svc()

  const [{ data: paciente }, { data: prof }, { data: notas }] = await Promise.all([
    db.from('pacientes')
      .select('nombre, apellido, dni, fecha_nacimiento, obra_social, numero_afiliado, plan_obra_social, motivo_consulta')
      .eq('id', paciente_id)
      .eq('terapeuta_id', user.id)
      .single(),
    db.from('profiles')
      .select('nombre, apellido, matricula, especialidad, direccion, localidad, provincia')
      .eq('id', user.id)
      .single(),
    db.from('notas_clinicas')
      .select('fecha, contenido')
      .eq('terapeuta_id', user.id)
      .eq('paciente_id', paciente_id)
      .not('borrador', 'is', true)
      .gte('fecha', periodo_desde)
      .lte('fecha', periodo_hasta)
      .order('fecha', { ascending: true }),
  ])

  if (!paciente || !prof) return NextResponse.json({ error: 'Datos no encontrados' }, { status: 404 })
  if (!notas || notas.length === 0) {
    return NextResponse.json({ error: 'No hay notas clínicas en el período seleccionado' }, { status: 400 })
  }

  const notasTexto = notas.map(n => `[${n.fecha}]\n${stripHtml(n.contenido)}`).join('\n\n---\n\n')

  const datosHeader = [
    `Paciente: ${paciente.nombre} ${paciente.apellido}`,
    `DNI: ${paciente.dni ?? '—'}`,
    `Fecha de nacimiento: ${paciente.fecha_nacimiento ? fmtFecha(paciente.fecha_nacimiento) : '—'}`,
    `Obra Social / Prepaga: ${paciente.obra_social ?? '—'}${paciente.plan_obra_social ? ` — Plan ${paciente.plan_obra_social}` : ''}`,
    `Nº de Afiliado: ${paciente.numero_afiliado ?? '—'}`,
  ].join('\n')

  const systemPrompt = `Sos un asistente médico especializado en redactar informes clínicos formales para presentar ante obras sociales y prepagas en Argentina. Redactás en español formal con lenguaje clínico apropiado. Usás ÚNICAMENTE la información provista — nunca inventás datos ni diagnósticos.`

  const userContent = `Redactá un informe médico estructurado con el siguiente formato EXACTO:

---
INFORME MÉDICO

${datosHeader}

Período evaluado: ${fmtFecha(periodo_desde)} al ${fmtFecha(periodo_hasta)}

DIAGNÓSTICO PRINCIPAL
${[diagnostico_cie10_codigo, diagnostico_cie10_descripcion].filter(Boolean).join(' — ') || '—'}

MOTIVO DEL INFORME
${tipo_solicitud}

RESUMEN DE EVOLUCIÓN CLÍNICA
[Redactá 2-3 párrafos en prosa formal sintetizando la evolución del paciente basándote ÚNICAMENTE en las notas clínicas provistas. Mencioná frecuencia de atención, temas trabajados y evolución observada. No inventés información.]

JUSTIFICACIÓN MÉDICA
[1-2 párrafos justificando la necesidad de la prestación/tratamiento solicitado, basándote en la evolución descripta.]${observaciones_profesional ? `\n\nOBSERVACIONES DEL PROFESIONAL\n${observaciones_profesional}` : ''}
---

Notas clínicas del período (${notas.length} nota${notas.length !== 1 ? 's' : ''}, orden cronológico):

${notasTexto}

IMPORTANTE: Generá solo el texto del informe con el formato indicado. Sin markdown adicional ni explicaciones.`

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: systemPrompt })
    const result = await model.generateContent(userContent)
    const contenido_generado = result.response.text().trim()

    const { data: informe, error: insertErr } = await db.from('informes_medicos').insert({
      terapeuta_id: user.id,
      paciente_id,
      tipo_solicitud,
      diagnostico_cie10_codigo: diagnostico_cie10_codigo || null,
      diagnostico_cie10_descripcion: diagnostico_cie10_descripcion || null,
      periodo_desde,
      periodo_hasta,
      observaciones_profesional: observaciones_profesional || null,
      contenido_generado,
      estado: 'borrador',
    } as never).select('id').single()

    if (insertErr || !informe) {
      return NextResponse.json({ error: 'Error al guardar el borrador' }, { status: 500 })
    }

    return NextResponse.json({ informe_id: (informe as { id: string }).id, contenido_generado })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
