import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'


export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { turno_id, paciente_id } = await req.json() as { turno_id?: string; paciente_id?: string }
  if (!turno_id || !paciente_id) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  // Check if cached summary already exists
  const { data: turno } = await supabase
    .from('turnos')
    .select('ai_summary')
    .eq('id', turno_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (turno?.ai_summary) {
    return NextResponse.json({ summary: turno.ai_summary, cached: true })
  }

  // Get professional's specialty
  const { data: profile } = await supabase
    .from('profiles')
    .select('especialidad')
    .eq('id', user.id)
    .single()

  const especialidad = profile?.especialidad ?? 'profesional de la salud'

  // Fetch clinical context in parallel
  const [
    { data: notas },
    { data: paciente },
    { data: medicaciones },
    { data: interconsultas },
  ] = await Promise.all([
    supabase
      .from('notas_clinicas')
      .select('contenido, created_at')
      .eq('paciente_id', paciente_id)
      .eq('terapeuta_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('pacientes')
      .select('codigo_diagnostico, modalidad_tratamiento, fecha_inicio_tratamiento')
      .eq('id', paciente_id)
      .single(),
    supabase
      .from('medicacion_paciente')
      .select('farmaco, dosis, frecuencia, prescriptor')
      .eq('paciente_id', paciente_id),
    Promise.resolve(
      supabase
        .from('interconsultas')
        .select('especialidad, profesional, estado, fecha')
        .eq('paciente_id', paciente_id)
        .eq('activa', true)
        .limit(5)
    ).catch(() => ({ data: [] as { especialidad: string; profesional: string; estado: string; fecha: string }[] })),
  ])

  // Build context string
  const notasTexto = (notas ?? []).map((n, i) =>
    `Nota ${i + 1} (${new Date(n.created_at).toLocaleDateString('es-AR')}): ${n.contenido}`
  ).join('\n\n')

  const medTexto = (medicaciones ?? []).map(m =>
    `- ${m.farmaco}${m.dosis ? ` ${m.dosis}` : ''}${m.frecuencia ? `, ${m.frecuencia}` : ''}${m.prescriptor ? ` (Dr/a. ${m.prescriptor})` : ''}`
  ).join('\n')

  const interconsultasTexto = (interconsultas ?? []).map((ic: Record<string, unknown>) =>
    `- ${ic.especialidad ?? ''} (${ic.profesional ?? ''}) — Estado: ${ic.estado ?? ''}, Fecha: ${ic.fecha ? new Date(ic.fecha as string).toLocaleDateString('es-AR') : 'sin fecha'}`
  ).join('\n')

  const systemPrompt = `Sos un asistente clínico de alta precisión integrado en KLIA, una plataforma para profesionales de la salud en Argentina. Estás asistiendo a un/a ${especialidad}.
Tu objetivo es permitirle al profesional simular una memoria clínica perfecta ante el paciente, aumentando el confort de este último respecto al seguimiento de su atención.
Adaptá el lenguaje, terminología y enfoque clínico al contexto de ${especialidad}. Por ejemplo:
- Si es psicólogo/terapeuta: enfocate en el hilo terapéutico, vínculos, mecanismos de defensa y pendientes emocionales.
- Si es cardiólogo: enfocate en parámetros cardiovasculares, medicación cardíaca y evolución de síntomas.
- Si es pediatra: considerá el desarrollo del niño, vacunación, crecimiento y contexto familiar.
- Para cualquier otra especialidad: adaptá el foco a los indicadores clínicos relevantes de esa disciplina.
RESTRICCIONES ESTRICTAS DE SALIDA:
- Prohibido usar saludos introductorios o conclusiones.
- El output debe ser directamente código Markdown limpio.
- Estructurar exclusivamente bajo estas tres secciones:
### 📌 Último Estado Clínico
Breve síntesis del estado anterior del paciente y pendientes relevantes para ${especialidad}.
### 💊 Alertas de Medicación e Interconsultas
Fármacos actuales con dosis, frecuencia y prescriptor. Estados de monitoreo médico externo e interconsultas activas.
### 🎯 Foco Sugerido para Hoy
Dos o tres preguntas o acciones tácticas sugeridas para guiar la apertura de la consulta de hoy, adaptadas al contexto de ${especialidad}.`

  const userContent = `
Especialidad: ${especialidad}
Diagnóstico: ${paciente?.codigo_diagnostico ?? 'No registrado'}
Modalidad de tratamiento: ${paciente?.modalidad_tratamiento ?? 'No registrada'}
Inicio de tratamiento: ${paciente?.fecha_inicio_tratamiento ? new Date(paciente.fecha_inicio_tratamiento).toLocaleDateString('es-AR') : 'No registrado'}

MEDICACIÓN ACTUAL:
${medTexto || 'Sin medicación registrada'}

INTERCONSULTAS ACTIVAS:
${interconsultasTexto || 'Sin interconsultas activas'}

ÚLTIMAS NOTAS CLÍNICAS:
${notasTexto || 'Sin notas clínicas previas'}
`

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    })
    const result = await model.generateContent(userContent)
    const summary = result.response.text()

    // Cache in DB
    await supabase
      .from('turnos')
      .update({ ai_summary: summary })
      .eq('id', turno_id)

    return NextResponse.json({ summary, cached: false })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Error Gemini:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
