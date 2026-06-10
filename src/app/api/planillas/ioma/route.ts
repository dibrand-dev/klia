import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generarPlanillaIoma } from '@/lib/planillas/ioma'
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
    sesiones_declaradas?: { fecha: string; hora_entrada: string; hora_salida: string }[]
  }
  const { paciente_id, mes, anio, sesiones_declaradas = [] } = body
  if (!paciente_id || !mes || !anio) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const db = svc()

  const [{ data: paciente }, { data: profile }] = await Promise.all([
    db.from('pacientes')
      .select('nombre, apellido, numero_afiliado, dni, firma_paciente_url')
      .eq('id', paciente_id)
      .single(),
    db.from('profiles')
      .select('nombre, apellido, matricula, firma_sello_url')
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
    const dia     = argDate.getUTCDate()
    const hh      = argDate.getUTCHours().toString().padStart(2, '0')
    const mm      = argDate.getUTCMinutes().toString().padStart(2, '0')
    const entrada = `${hh}:${mm}`
    const fin     = new Date(argDate.getTime() + (t.duracion_min ?? 50) * 60 * 1000)
    const salida  = `${fin.getUTCHours().toString().padStart(2, '0')}:${fin.getUTCMinutes().toString().padStart(2, '0')}`
    return { dia, entrada, salida }
  })

  const sesionesDecl = sesiones_declaradas.map((d) => {
    const [, , day] = d.fecha.split('-')
    return { dia: parseInt(day, 10), entrada: d.hora_entrada, salida: d.hora_salida }
  })

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPlanillaIoma({
      paciente:           `${paciente.apellido}, ${paciente.nombre}`.toUpperCase(),
      nroAfiliado:        paciente.numero_afiliado ?? '',
      mes:                `${MESES[mes - 1]} ${anio}`,
      profesional:        `${profile.apellido}, ${profile.nombre}`.toUpperCase(),
      matricula:          profile.matricula ?? '',
      sesiones: [...sesiones, ...sesionesDecl],
      firmaProfesionalUrl: profile.firma_sello_url ?? undefined,
      dni:                paciente.dni ?? undefined,
    })
  } catch (err) {
    console.error('[planilla/ioma] PDF generation failed:', err)
    return NextResponse.json(
      { error: 'Error al generar el PDF', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  const filename = `IOMA_${paciente.apellido}_${MESES[mes - 1]}_${anio}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
