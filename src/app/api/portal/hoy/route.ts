import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import { estaEnPlazo, estaEnPlazoLibre } from '@/lib/portal/plazo'
import { diasRetencionPorPlan, fotoVencida } from '@/lib/portal/retencion'
import { planVigentePorFecha } from '@/lib/portal/plan-vigente'
import { armarComentarioProfesional, comentarioProfesionalEsNuevo, formatNombreProfesional, type ComentarioProfesionalRow } from '@/lib/portal/comentario-profesional'
import { hoyFechaAR } from '@/lib/tz'
import { diaSemanaKey, diffDias, sumarDias } from '@/lib/portal/semana'
import { compararComidas } from '@/lib/nutricion/orden-comidas'
import { COMIDAS_LIBRES, COMIDA_LIBRE_MULTIPLE } from '@/lib/portal/comidas-libres'

export const runtime = 'nodejs'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const SEMANAS_ATRAS_MAX = 12

type ComidaRow = { id: string; tipo_comida: string; hora: string | null; orden: number }
type RegistroRow = {
  id: string
  plan_comida_id: string | null
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

interface FilaOut {
  clave: string
  tipoComida: string
  hora: string | null
  planComidaId: string | null
  estado: 'registrada' | 'pendiente' | 'vencida'
  registro: {
    id: string
    registradoAt: string
    comentario: string | null
    fotoVencida: boolean
    fotoVersion: number
    comentarioProfesional: ReturnType<typeof armarComentarioProfesional>
  } | null
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
  const { data: comidasRaw } = plan
    ? await db.from('plan_comidas').select('id, tipo_comida, hora, orden').eq('plan_id', plan.id).eq('dia_semana', dia)
    : { data: [] as ComidaRow[] }
  const comidasDelPlan = ((comidasRaw ?? []) as ComidaRow[]).sort(compararComidas)

  // Modo libre: sin plan vigente, O con plan pero sin comidas cargadas para
  // este día puntual (ej. plan de lunes a viernes, hoy es domingo).
  const modoLibre = !plan || comidasDelPlan.length === 0

  const { data: registrosRaw } = await db
    .from('portal_registros')
    .select('id, plan_comida_id, tipo_comida, registrado_at, comentario, foto_vencida, updated_at, comentario_profesional, comentario_profesional_at, comentario_profesional_editado_at, comentario_profesional_por, comentario_visto_at')
    .eq('paciente_id', principal.pacienteId)
    .eq('terapeuta_id', principal.terapeutaId)
    .eq('fecha_local', fecha)
  const registros = (registrosRaw ?? []) as RegistroRow[]

  // Nombre del autor del comentario — casi siempre es el profesional dueño
  // actual (único que puede escribir); si comentario_profesional_por quedó
  // null (autor eliminado) o referencia a otro perfil, se resuelve aparte.
  const idsAutoresExtra = Array.from(new Set(
    registros.map((r) => r.comentario_profesional_por).filter((id): id is string => !!id && id !== principal.terapeutaId),
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

  function registroOut(r: RegistroRow): FilaOut['registro'] {
    return {
      id: r.id,
      registradoAt: r.registrado_at,
      comentario: r.comentario,
      fotoVencida: fotoVencida(r, diasRetencion),
      fotoVersion: new Date(r.updated_at).getTime(),
      comentarioProfesional: armarComentarioProfesional(r as ComentarioProfesionalRow, nombreAutor(r.comentario_profesional_por)),
    }
  }

  const ahora = new Date()
  let filas: FilaOut[]

  if (!modoLibre) {
    // Modo plan — se matchea por plan_comida_id (no por tipo_comida): si un
    // día tuvo un registro libre (plan_comida_id null) antes de que se le
    // cargara el plan, ese registro histórico NUNCA debe mezclarse acá.
    const registroPorPlanComidaId = new Map<string, RegistroRow>()
    for (const r of registros) if (r.plan_comida_id) registroPorPlanComidaId.set(r.plan_comida_id, r)

    filas = comidasDelPlan.map((c) => {
      const registro = registroPorPlanComidaId.get(c.id) ?? null
      const estado: FilaOut['estado'] = registro ? 'registrada' : estaEnPlazo(fecha, c.hora, ahora) ? 'pendiente' : 'vencida'
      return {
        clave: c.id,
        tipoComida: c.tipo_comida,
        hora: c.hora,
        planComidaId: c.id,
        estado,
        registro: registro ? registroOut(registro) : null,
      }
    })
  } else {
    // Modo libre — filas fijas (COMIDAS_LIBRES). Colación admite varios
    // registros por día: se listan todos + una fila "pendiente" al final
    // para agregar otra, mientras siga en plazo.
    const registrosLibres = registros.filter((r) => r.plan_comida_id === null)
    const registrosPorTipo = new Map<string, RegistroRow[]>()
    for (const r of registrosLibres) {
      const arr = registrosPorTipo.get(r.tipo_comida) ?? []
      arr.push(r)
      registrosPorTipo.set(r.tipo_comida, arr)
    }
    const enPlazo = estaEnPlazoLibre(fecha, ahora)

    filas = []
    for (const tipo of COMIDAS_LIBRES) {
      const delTipo = (registrosPorTipo.get(tipo) ?? []).sort((a, b) => a.registrado_at.localeCompare(b.registrado_at))
      if (tipo === COMIDA_LIBRE_MULTIPLE) {
        for (const r of delTipo) {
          filas.push({ clave: r.id, tipoComida: tipo, hora: null, planComidaId: null, estado: 'registrada', registro: registroOut(r) })
        }
        filas.push({
          clave: `${tipo}-nueva`, tipoComida: tipo, hora: null, planComidaId: null,
          estado: enPlazo ? 'pendiente' : 'vencida', registro: null,
        })
      } else if (delTipo.length > 0) {
        filas.push({ clave: delTipo[0].id, tipoComida: tipo, hora: null, planComidaId: null, estado: 'registrada', registro: registroOut(delTipo[0]) })
      } else {
        filas.push({ clave: tipo, tipoComida: tipo, hora: null, planComidaId: null, estado: enPlazo ? 'pendiente' : 'vencida', registro: null })
      }
    }
  }

  return NextResponse.json({ fecha, modoLibre, registroHabilitado, diasRetencion, diasConComentarioNuevo, filas })
}
