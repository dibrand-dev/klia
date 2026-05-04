import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generarPlanillaHospitalItaliano } from '@/lib/planillas/hospital-italiano'
import type { Database } from '@/types/database'
import type { SesionPlanilla } from '@/lib/planillas/hospital-italiano'

// Force Node.js runtime (pdfkit requires Node streams)
export const runtime = 'nodejs'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

function db() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  // 1. Auth check
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    paciente_id: string
    mes: number      // 1-12
    anio: number
    os_config_id: string
  }

  const { paciente_id, mes, anio, os_config_id } = body
  if (!paciente_id || !mes || !anio || !os_config_id) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const svc = db()

  // 2-4. Fetch all data in parallel
  const [
    { data: paciente },
    { data: profile },
    { data: osConfig },
  ] = await Promise.all([
    svc.from('pacientes')
      .select('nombre, apellido, numero_afiliado, numero_autorizacion')
      .eq('id', paciente_id)
      .single(),
    svc.from('profiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single(),
    svc.from('profesional_obras_sociales')
      .select('nombre, descripcion_practica, domicilio_os')
      .eq('id', os_config_id)
      .single(),
  ])

  if (!paciente || !profile) {
    return NextResponse.json({ error: 'Datos no encontrados' }, { status: 404 })
  }

  // 5. Fetch turnos for this patient and month
  // Argentina is UTC-3; month boundaries in UTC
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0))
  const finMes    = new Date(Date.UTC(anio, mes,     1, 3, 0, 0))

  const { data: turnos } = await svc
    .from('turnos')
    .select('fecha_hora, duracion_min')
    .eq('terapeuta_id', user.id)
    .eq('paciente_id', paciente_id)
    .gte('fecha_hora', inicioMes.toISOString())
    .lt('fecha_hora', finMes.toISOString())
    .in('estado', ['realizado', 'no_asistio'])
    .order('fecha_hora')

  // 6. Map turnos to SesionPlanilla (convert UTC → Argentina time)
  const sesiones: SesionPlanilla[] = (turnos ?? []).map((t) => {
    const argDate = new Date(new Date(t.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
    const dia = argDate.getUTCDate().toString().padStart(2, '0')
    const mesDia = (argDate.getUTCMonth() + 1).toString().padStart(2, '0')
    const hh = argDate.getUTCHours().toString().padStart(2, '0')
    const mm = argDate.getUTCMinutes().toString().padStart(2, '0')
    const horaInicio = `${hh}:${mm}`

    const finDate = new Date(argDate.getTime() + t.duracion_min * 60 * 1000)
    const horaFin = `${finDate.getUTCHours().toString().padStart(2, '0')}:${finDate.getUTCMinutes().toString().padStart(2, '0')}`

    return { dia, mes: mesDia, horaInicio, horaFin }
  })

  // 7. Fetch OS logo from storage
  // Logos are stored by obras_sociales.id (global table), not profesional_obras_sociales.id.
  // Resolve via name match.
  let logoUrl: string | undefined
  if (osConfig) {
    const { data: osBase } = await svc
      .from('obras_sociales')
      .select('id')
      .ilike('nombre', osConfig.nombre)
      .eq('validada', true)
      .limit(1)
      .maybeSingle()
    const logoOsId = osBase?.id
    if (logoOsId) {
      const { data: logoFiles } = await svc.storage.from('obras-sociales').list('logos', { search: logoOsId })
      const logoFile = (logoFiles ?? []).find((f) => f.name.startsWith(logoOsId))
      if (logoFile) {
        const { data } = svc.storage.from('obras-sociales').getPublicUrl(`logos/${logoFile.name}`)
        logoUrl = data.publicUrl
      }
    }
  }

  // 8. Generate PDF
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPlanillaHospitalItaliano({
      anio: anio.toString(),
      prestador: `${profile.apellido} ${profile.nombre}`.toUpperCase(),
      domicilio: osConfig?.domicilio_os ?? '',
      afiliado: `${paciente.apellido} ${paciente.nombre}`.toUpperCase(),
      numeroSocio: paciente.numero_afiliado ?? '',
      tratamiento: osConfig?.descripcion_practica ?? osConfig?.nombre ?? '',
      mes: MESES[mes - 1],
      numeroAutorizacion: paciente.numero_autorizacion ?? '',
      sesiones,
      logoUrl,
    })
  } catch (err) {
    console.error('[planilla/hospital-italiano] PDF generation failed:', err)
    return NextResponse.json(
      { error: 'Error al generar el PDF', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  // 9. Return PDF
  const filename = `Planilla_${paciente.apellido}_${MESES[mes - 1]}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
