import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generarPlanillaGenerica } from '@/lib/planillas/motor-generico'
import type { Database } from '@/types/database'
import type { ConfigPlanilla, SesionGenerica } from '@/lib/planillas/motor-generico'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const runtime = 'nodejs'

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function svc() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { paciente_id: string; mes: number; anio: number; os_config_id: string }
  const { paciente_id, mes, anio, os_config_id } = body
  if (!paciente_id || !mes || !anio || !os_config_id) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const db = svc()

  const [
    { data: paciente },
    { data: profile },
    { data: osConfig },
  ] = await Promise.all([
    db.from('pacientes').select('nombre,apellido,numero_afiliado,numero_autorizacion,firma_paciente_url').eq('id', paciente_id).single(),
    db.from('profiles').select('nombre,apellido,firma_sello_url').eq('id', efectivo.terapeutaId).single(),
    db.from('profesional_obras_sociales').select('nombre,descripcion_practica,domicilio_os,planilla_template_id').eq('id', os_config_id).single(),
  ])

  if (!paciente || !profile) return NextResponse.json({ error: 'Datos no encontrados' }, { status: 404 })

  const templateId = osConfig?.planilla_template_id
  if (!templateId) return NextResponse.json({ error: 'Esta obra social no tiene plantilla configurada' }, { status: 422 })

  const { data: template } = await db.from('planilla_templates').select('*').eq('id', templateId).single()
  if (!template) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })

  // If requiere_firma_olografa, inform the client (it can still generate)
  const config = template.config as unknown as ConfigPlanilla

  // Fetch logo from storage via obras_sociales name match
  let logoUrl: string | undefined
  const { data: osBase } = await db.from('obras_sociales').select('id').ilike('nombre', osConfig?.nombre ?? '').eq('validada', true).limit(1).maybeSingle()
  if (osBase) {
    const { data: logoFiles } = await db.storage.from('obras-sociales').list('logos', { search: osBase.id })
    const lf = (logoFiles ?? []).find(f => f.name.startsWith(osBase.id))
    if (lf) {
      const { data } = db.storage.from('obras-sociales').getPublicUrl(`logos/${lf.name}`)
      logoUrl = data.publicUrl
    }
  }

  // Fetch turnos
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1, 3, 0, 0))
  const finMes    = new Date(Date.UTC(anio, mes, 1, 3, 0, 0))
  const { data: turnos } = await db.from('turnos').select('fecha_hora,duracion_min').eq('terapeuta_id', efectivo.terapeutaId).eq('paciente_id', paciente_id).gte('fecha_hora', inicioMes.toISOString()).lt('fecha_hora', finMes.toISOString()).in('estado', ['realizado', 'no_asistio']).order('fecha_hora')

  const incluirFirmas = !(template.requiere_firma_olografa as boolean)

  const sesiones: SesionGenerica[] = (turnos ?? []).map(t => {
    const argDate = new Date(new Date(t.fecha_hora).getTime() - 3 * 60 * 60 * 1000)
    const dia     = argDate.getUTCDate().toString().padStart(2, '0')
    const mesDia  = (argDate.getUTCMonth() + 1).toString().padStart(2, '0')
    const hh      = argDate.getUTCHours().toString().padStart(2, '0')
    const mm      = argDate.getUTCMinutes().toString().padStart(2, '0')
    const horaInicio = `${hh}:${mm}`
    const finDate = new Date(argDate.getTime() + t.duracion_min * 60 * 1000)
    const horaFin = `${finDate.getUTCHours().toString().padStart(2, '0')}:${finDate.getUTCMinutes().toString().padStart(2, '0')}`
    return {
      fecha:       `${dia}/${mesDia}`,
      diaSemana:   DIAS[argDate.getUTCDay()],
      horaInicio,
      horaFin,
      horario:     `${horaInicio} - ${horaFin}`,
      firmaProfesionalUrl: incluirFirmas ? (profile.firma_sello_url ?? undefined) : undefined,
      firmaPacienteUrl:    incluirFirmas ? (paciente.firma_paciente_url ?? undefined) : undefined,
    }
  })

  const mesAnio = `${MESES[mes - 1]} ${anio}`
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPlanillaGenerica(config, {
      anio: anio.toString(),
      prestador: `${profile.apellido}, ${profile.nombre}`.toUpperCase(),
      domicilio: osConfig?.domicilio_os ?? '',
      afiliado: `${paciente.apellido} ${paciente.nombre}`.toUpperCase(),
      numeroSocio: paciente.numero_afiliado ?? '',
      tratamiento: osConfig?.descripcion_practica ?? osConfig?.nombre ?? '',
      mesAnio,
      numeroAutorizacion: paciente.numero_autorizacion ?? '',
      logoUrl,
      sesiones,
    })
  } catch (err) {
    console.error('[planillas/generar]', err)
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 })
  }

  const filename = `Planilla_${paciente.apellido}_${MESES[mes - 1]}_${anio}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
