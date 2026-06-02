import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generarPlanillaSwissMedical } from '@/lib/planillas/swiss-medical'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

function svc() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    paciente_id: string
    mes: number
    anio: number
    os_config_id?: string
  }
  const { paciente_id, mes, anio } = body
  if (!paciente_id || !mes || !anio) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const db = svc()

  const [{ data: paciente }, { data: profile }] = await Promise.all([
    db.from('pacientes')
      .select('nombre, apellido, dni, firma_paciente_url')
      .eq('id', paciente_id)
      .single(),
    db.from('profiles')
      .select('nombre, apellido, especialidad, matricula, firma_url, firma_sello_url')
      .eq('id', user.id)
      .single(),
  ])

  if (!paciente || !profile) {
    return NextResponse.json({ error: 'Datos no encontrados' }, { status: 404 })
  }

  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0))
  const finMes    = new Date(Date.UTC(anio, mes,     1, 3, 0, 0))

  const { data: turnos } = await db
    .from('turnos')
    .select('fecha_hora, duracion_min')
    .eq('terapeuta_id', user.id)
    .eq('paciente_id', paciente_id)
    .gte('fecha_hora', inicioMes.toISOString())
    .lt('fecha_hora', finMes.toISOString())
    .in('estado', ['realizado', 'no_asistio'])
    .order('fecha_hora')

  const sesiones = (turnos ?? []).map((t) => {
    const argDate = new Date(new Date(t.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
    const dd = argDate.getUTCDate().toString().padStart(2, '0')
    const mm = (argDate.getUTCMonth() + 1).toString().padStart(2, '0')
    const hh = argDate.getUTCHours().toString().padStart(2, '0')
    const min = argDate.getUTCMinutes().toString().padStart(2, '0')
    return { fecha: `${dd}/${mm}`, horario: `${hh}:${min}` }
  })

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPlanillaSwissMedical({
      mes:                 String(mes).padStart(2, '0'),
      anio:                String(anio),
      paciente:            `${paciente.apellido} ${paciente.nombre}`.toUpperCase(),
      dni:                 paciente.dni ?? '',
      tipoTratamiento:     profile.especialidad ?? '',
      profesional:         `${profile.apellido} ${profile.nombre}`.toUpperCase(),
      sesiones,
      firmaPacienteUrl:    paciente.firma_paciente_url ?? undefined,
      firmaProfesionalUrl: profile.firma_url ?? undefined,
      selloUrl:            profile.firma_sello_url ?? undefined,
      matricula:           profile.matricula ?? '',
    })
  } catch (err) {
    console.error('[planilla/swiss-medical] PDF generation failed:', err)
    return NextResponse.json(
      { error: 'Error al generar el PDF', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  const filename = `SwissMedical_${paciente.apellido}_${MESES[mes - 1]}_${anio}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
