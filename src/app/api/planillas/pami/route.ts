import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generarPlanillaPami } from '@/lib/planillas/pami'
import type { Database } from '@/types/database'
import type { SesionPami } from '@/lib/planillas/pami'

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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    paciente_id: string
    mes: number
    anio: number
    os_config_id: string
    sesiones_declaradas?: { fecha: string; hora_entrada: string; hora_salida: string }[]
  }

  const { paciente_id, mes, anio, os_config_id, sesiones_declaradas = [] } = body
  if (!paciente_id || !mes || !anio || !os_config_id) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const svc = db()

  const [
    { data: paciente },
    { data: profile },
    { data: osConfig },
  ] = await Promise.all([
    svc.from('pacientes')
      .select('nombre, apellido, numero_afiliado, dni, contacto_emergencia_nombre, firma_paciente_url')
      .eq('id', paciente_id)
      .single(),
    svc.from('profiles')
      .select('nombre, apellido, matricula, matricula_tipo, matricula_provincia, firma_sello_url')
      .eq('id', user.id)
      .single(),
    svc.from('profesional_obras_sociales')
      .select('nombre, razon_social')
      .eq('id', os_config_id)
      .single(),
  ])

  if (!paciente || !profile) {
    return NextResponse.json({ error: 'Datos no encontrados' }, { status: 404 })
  }

  // Argentina is UTC-3; month boundaries in UTC
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0))
  const finMes    = new Date(Date.UTC(anio, mes,     1, 3, 0, 0))

  const { data: turnos } = await svc
    .from('turnos')
    .select('fecha_hora')
    .eq('terapeuta_id', user.id)
    .eq('paciente_id', paciente_id)
    .gte('fecha_hora', inicioMes.toISOString())
    .lt('fecha_hora', finMes.toISOString())
    .in('estado', ['realizado', 'no_asistio'])
    .order('fecha_hora')

  const sesionesDecl: SesionPami[] = sesiones_declaradas.map((d) => {
    const [, month, day] = d.fecha.split('-')
    return {
      dia: day,
      mes: month,
      firmaProfesionalUrl: profile?.firma_sello_url ?? undefined,
      firmaFamiliarUrl: paciente?.firma_paciente_url ?? undefined,
    }
  })

  const sesiones: SesionPami[] = (turnos ?? []).map((t) => {
    const argDate = new Date(new Date(t.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
    const dia = argDate.getUTCDate().toString().padStart(2, '0')
    const mesDia = (argDate.getUTCMonth() + 1).toString().padStart(2, '0')
    return {
      dia, mes: mesDia,
      firmaProfesionalUrl: profile?.firma_sello_url ?? undefined,
      firmaFamiliarUrl: paciente?.firma_paciente_url ?? undefined,
    }
  })

  // Logo — resolved via name match against the global obras_sociales table
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

  // profiles.matricula se guarda siempre sin prefijo (ver PerfilProfesional.tsx / AjustesClient.tsx,
  // que lo arman recién en la UI) — este strip es solo defensivo por si algún dato viejo lo tuviera.
  const matriculaLimpia = profile.matricula?.replace(/^(MN|MP)\s*/i, '') ?? ''
  const matricula = matriculaLimpia
    ? `${profile.matricula_tipo === 'nacional' ? 'MN' : 'MP'} ${matriculaLimpia}${profile.matricula_tipo === 'provincial' && profile.matricula_provincia ? ` (${profile.matricula_provincia})` : ''}`
    : ''

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPlanillaPami({
      afiliadoNombre: `${paciente.apellido}, ${paciente.nombre}`.toUpperCase(),
      numeroBeneficio: paciente.numero_afiliado ?? '',
      afiliadoDni: paciente.dni ?? '',
      familiarNombre: paciente.contacto_emergencia_nombre ?? undefined,
      profesionalNombre: `${profile.apellido}, ${profile.nombre}`.toUpperCase(),
      matricula,
      nombrePrestador: osConfig?.razon_social || `${profile.apellido}, ${profile.nombre}`.toUpperCase(),
      sesiones: [...sesiones, ...sesionesDecl].sort((a, b) => {
        const d = parseInt(a.mes) * 100 + parseInt(a.dia) - (parseInt(b.mes) * 100 + parseInt(b.dia))
        return d
      }),
      logoUrl,
    })
  } catch (err) {
    console.error('[planilla/pami] PDF generation failed:', err)
    return NextResponse.json(
      { error: 'Error al generar el PDF', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  const filename = `PAMI_${paciente.apellido}_${MESES[mes - 1]}_${anio}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
