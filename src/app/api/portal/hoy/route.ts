import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import { estaEnPlazo } from '@/lib/portal/plazo'
import { diasRetencionPorPlan, fotoVencida } from '@/lib/portal/retencion'
import { planVigentePorFecha } from '@/lib/portal/plan-vigente'
import { armarComentarioProfesional, comentarioProfesionalEsNuevo, formatNombreProfesional, type ComentarioProfesionalRow } from '@/lib/portal/comentario-profesional'
import { hoyFechaAR } from '@/lib/tz'
import { diaSemanaKey, diffDias, sumarDias } from '@/lib/portal/semana'
import { compararComidas } from '@/lib/nutricion/orden-comidas'

export const runtime = 'nodejs'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const SEMANAS_ATRAS_MAX = 12

type ComidaRow = { id: string; tipo_comida: string; hora: string | null; orden: number }
type RegistroRow = {
  id: string
  tipo_comida: string
  registrado_at: string
  comentario: string | null
  foto_vencida: boolean
  updated_at: string
  comentario_profesional: string | null
  comentario_profesional_at: string | null
  comentario_profesional_editado_at: string | null
  comentario_profesional_por: string | null
  comentario_visto_at: string | null
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

  const fechaParam = req.nextUrl.searchParams.get('fecha')
  const fecha = fechaParam && FECHA_REGEX.test(fechaParam) ? fechaParam : hoyFechaAR()

  // desde/hasta acotan la ventana de 7 días que muestra la tira de Hoy — se
  // usan solo para resolver diasConComentarioNuevo con una sola consulta por
  // rango. Si no vienen, se acota a la propia fecha (sin ventana extra).
  const hoy = hoyFechaAR()
  const limiteAtras = sumarDias(hoy, -7 * SEMANAS_ATRAS_MAX)
  const desdeParam = req.nextUrl.searchParams.get('desde')
  const hastaParam = req.nextUrl.searchParams.get('hasta')
  let desde = fecha
  let hasta = fecha
  if (desdeParam || hastaParam) {
    if (!desdeParam || !hastaParam || !FECHA_REGEX.test(desdeParam) || !FECHA_REGEX.test(hastaParam)) {
      return NextResponse.json({ error: 'rango_invalido', message: 'Rango de fechas inválido.' }, { status: 400 })
    }
    if (desdeParam > hastaParam || diffDias(hastaParam, desdeParam) > 6) {
      return NextResponse.json({ error: 'rango_invalido', message: 'El rango no puede superar 7 días.' }, { status: 400 })
    }
    if (hastaParam > hoy || desdeParam < limiteAtras) {
      return NextResponse.json({ error: 'rango_invalido', message: 'El rango está fuera de lo permitido.' }, { status: 400 })
    }
    desde = desdeParam
    hasta = hastaParam
  }

  const dia = diaSemanaKey(fecha)

  const [{ data: acceso }, { data: profile }] = await Promise.all([
    db.from('paciente_accesos').select('registro_habilitado').eq('paciente_id', principal.pacienteId).eq('terapeuta_id', principal.terapeutaId).eq('estado', 'activo').maybeSingle(),
    db.from('profiles').select('plan, nombre, apellido').eq('id', principal.terapeutaId).maybeSingle(),
  ])

  const registroHabilitado = acceso?.registro_habilitado ?? true
  const diasRetencion = await diasRetencionPorPlan(db, profile?.plan ?? null)
  const nombreProfesionalActual = formatNombreProfesional(profile?.nombre ?? null, profile?.apellido ?? null)

  // Días con comentario nuevo sin ver dentro de la ventana de 7 días — una
  // sola consulta por rango, nunca una por día.
  const { data: rangoRaw } = await db
    .from('portal_registros')
    .select('fecha_local, comentario_profesional, comentario_profesional_at, comentario_profesional_editado_at, comentario_visto_at')
    .eq('paciente_id', principal.pacienteId)
    .eq('terapeuta_id', principal.terapeutaId)
    .not('comentario_profesional', 'is', null)
    .gte('fecha_local', desde)
    .lte('fecha_local', hasta)
  const diasConComentarioNuevo = Array.from(new Set(
    (rangoRaw ?? []).filter((r) => comentarioProfesionalEsNuevo(r)).map((r) => r.fecha_local as string),
  ))

  const plan = await planVigentePorFecha(db, principal.pacienteId, principal.terapeutaId, fecha)
  if (!plan) {
    return NextResponse.json({ fecha, noPlan: false, registroHabilitado, diasRetencion, diasConComentarioNuevo, filas: [] })
  }

  const [{ data: comidasRaw }, { data: registrosRaw }] = await Promise.all([
    db.from('plan_comidas').select('id, tipo_comida, hora, orden').eq('plan_id', plan.id).eq('dia_semana', dia),
    db.from('portal_registros')
      .select('id, tipo_comida, registrado_at, comentario, foto_vencida, updated_at, comentario_profesional, comentario_profesional_at, comentario_profesional_editado_at, comentario_profesional_por, comentario_visto_at')
      .eq('paciente_id', principal.pacienteId)
      .eq('terapeuta_id', principal.terapeutaId)
      .eq('fecha_local', fecha),
  ])

  const comidas = ((comidasRaw ?? []) as ComidaRow[]).sort(compararComidas)
  const registroPorTipo = new Map<string, RegistroRow>()
  for (const r of (registrosRaw ?? []) as RegistroRow[]) registroPorTipo.set(r.tipo_comida, r)

  // Nombre del autor del comentario — casi siempre es el profesional dueño
  // actual (único que puede escribir); si comentario_profesional_por quedó
  // null (autor eliminado) o referencia a otro perfil, se resuelve aparte.
  const idsAutoresExtra = Array.from(new Set(
    Array.from(registroPorTipo.values())
      .map((r) => r.comentario_profesional_por)
      .filter((id): id is string => !!id && id !== principal.terapeutaId),
  ))
  const nombrePorAutorId = new Map<string, string>([[principal.terapeutaId, nombreProfesionalActual]])
  if (idsAutoresExtra.length > 0) {
    const { data: autores } = await db.from('profiles').select('id, nombre, apellido').in('id', idsAutoresExtra)
    for (const a of autores ?? []) nombrePorAutorId.set(a.id, formatNombreProfesional(a.nombre, a.apellido))
  }
  function nombreAutor(autorId: string | null): string {
    if (autorId && nombrePorAutorId.has(autorId)) return nombrePorAutorId.get(autorId)!
    return nombreProfesionalActual
  }

  const ahora = new Date()
  const filas = comidas.map((c) => {
    const registro = registroPorTipo.get(c.tipo_comida) ?? null
    const estado: 'registrada' | 'pendiente' | 'vencida' = registro
      ? 'registrada'
      : estaEnPlazo(fecha, c.hora, ahora) ? 'pendiente' : 'vencida'

    return {
      tipoComida: c.tipo_comida,
      hora: c.hora,
      planComidaId: c.id,
      estado,
      registro: registro ? {
        id: registro.id,
        registradoAt: registro.registrado_at,
        comentario: registro.comentario,
        fotoVencida: fotoVencida(registro, diasRetencion),
        fotoVersion: new Date(registro.updated_at).getTime(),
        comentarioProfesional: armarComentarioProfesional(registro, nombreAutor(registro.comentario_profesional_por)),
      } : null,
    }
  })

  return NextResponse.json({ fecha, noPlan: false, registroHabilitado, diasRetencion, diasConComentarioNuevo, filas })
}
