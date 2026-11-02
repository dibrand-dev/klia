import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { puedeUsarPortal } from '@/lib/portal/acceso'
import { diasRetencionPorPlan } from '@/lib/portal/retencion'
import { hoyFechaAR } from '@/lib/tz'
import { lunesDe, rangoSemana, sumarDias, diaSemanaKey } from '@/lib/portal/semana'
import { compararItems } from '@/lib/nutricion/orden-comidas'

export const runtime = 'nodejs'

const SEMANAS_ATRAS_MAX = 12

type ItemRow = {
  id: string
  tipo: string
  contenido_texto: string | null
  alimento_fuente: string | null
  alimento_id: string | null
  cantidad_gramos: number | null
  orden: number
}

type ComidaRow = {
  id: string
  dia_semana: string
  tipo_comida: string
  hora: string | null
  nota: string | null
  orden: number
  plan_comida_items: ItemRow[]
}

type RegistroRow = {
  id: string
  plan_comida_id: string | null
  tipo_comida: string
  fecha_local: string
  registrado_at: string
  foto_vencida: boolean
  comentario: string | null
}

function horaActualAR(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit',
  })
}

function esDue(fecha: string, hoy: string, horaComida: string | null, horaActual: string): boolean {
  if (fecha < hoy) return true
  if (fecha > hoy) return false
  if (!horaComida) return true
  return horaComida.slice(0, 5) <= horaActual
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const [{ data: paciente }, { data: profile }] = await Promise.all([
    db.from('pacientes').select('id').eq('id', params.id).eq('terapeuta_id', efectivo.terapeutaId).maybeSingle(),
    db.from('profiles').select('plan').eq('id', efectivo.terapeutaId).maybeSingle(),
  ])
  if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const habilitado = await puedeUsarPortal(db, efectivo.terapeutaId)
  if (!habilitado) {
    return NextResponse.json({ error: 'portal_no_habilitado', message: 'Tu plan no incluye el portal del paciente.' }, { status: 403 })
  }

  const hoy = hoyFechaAR()
  const lunesActual = lunesDe(hoy)
  const lunesMinimo = sumarDias(lunesActual, -7 * SEMANAS_ATRAS_MAX)
  const semanaParam = req.nextUrl.searchParams.get('semana')
  let lunes = lunesDe(semanaParam ?? hoy)
  if (lunes > lunesActual) lunes = lunesActual
  if (lunes < lunesMinimo) lunes = lunesMinimo
  const dias = rangoSemana(lunes)

  const { data: planActivo } = await db
    .from('planes_alimentarios')
    .select('id')
    .eq('paciente_id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .eq('estado', 'activo')
    .maybeSingle()

  const { data: planComidasRaw } = planActivo
    ? await db.from('plan_comidas')
      .select('id, dia_semana, tipo_comida, hora, nota, orden, plan_comida_items(*)')
      .eq('plan_id', planActivo.id)
    : { data: [] as ComidaRow[] }
  const planComidas = (planComidasRaw ?? []) as unknown as ComidaRow[]

  const { data: registrosRaw } = await db
    .from('portal_registros')
    .select('id, plan_comida_id, tipo_comida, fecha_local, registrado_at, foto_vencida, comentario')
    .eq('paciente_id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .gte('fecha_local', dias[0])
    .lte('fecha_local', dias[6])
  const registros = (registrosRaw ?? []) as RegistroRow[]

  // comida vigente de cada día de la semana (dia_semana + tipo_comida -> fila del plan activo)
  const comidaPorDiaYTipo = new Map<string, ComidaRow>()
  for (const c of planComidas) comidaPorDiaYTipo.set(`${c.dia_semana}|${c.tipo_comida}`, c)

  const registroPorFechaYTipo = new Map<string, RegistroRow>()
  for (const r of registros) registroPorFechaYTipo.set(`${r.fecha_local}|${r.tipo_comida}`, r)

  // Filas: unión de tipo_comida del plan activo (todos los días) y de los
  // registros de esta semana, ordenadas por plan_comidas.orden (las que solo
  // existen en registros históricos, sin fila vigente, al final).
  const ordenPorTipo = new Map<string, number>()
  const horaPorTipo = new Map<string, string | null>()
  for (const dia of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']) {
    for (const c of planComidas) {
      if (c.dia_semana !== dia) continue
      if (!ordenPorTipo.has(c.tipo_comida)) {
        ordenPorTipo.set(c.tipo_comida, c.orden)
        horaPorTipo.set(c.tipo_comida, c.hora)
      }
    }
  }
  const tiposFilas = new Set<string>(Array.from(ordenPorTipo.keys()).concat(registros.map((r) => r.tipo_comida)))
  // Mismo criterio que compararComidas (orden → hora → desempate final
  // estable) — acá el desempate final es el string de tipo_comida en vez de
  // un id porque esto agrupa por NOMBRE de comida a través de varios días,
  // no son filas individuales con id propio.
  const filas = Array.from(tiposFilas).sort((a, b) => {
    const oa = ordenPorTipo.get(a) ?? Infinity
    const ob = ordenPorTipo.get(b) ?? Infinity
    if (oa !== ob) return oa - ob
    const ha = horaPorTipo.get(a) ?? '99:99:99'
    const hb = horaPorTipo.get(b) ?? '99:99:99'
    if (ha !== hb) return ha < hb ? -1 : 1
    return a.localeCompare(b)
  })

  // Comidas históricas (plan_comida_id de un registro) que ya no están en el
  // plan vigente — hay que resolverlas igual para el SlideOver.
  const idsPlanVigente = new Set(planComidas.map((c) => c.id))
  const idsHistoricos = Array.from(new Set(
    registros.map((r) => r.plan_comida_id).filter((id): id is string => !!id && !idsPlanVigente.has(id)),
  ))
  const { data: comidasHistoricasRaw } = idsHistoricos.length > 0
    ? await db.from('plan_comidas').select('id, dia_semana, tipo_comida, hora, nota, orden, plan_comida_items(*)').in('id', idsHistoricos)
    : { data: [] as ComidaRow[] }
  const comidaPorId = new Map<string, ComidaRow>()
  for (const c of [...planComidas, ...((comidasHistoricasRaw ?? []) as unknown as ComidaRow[])]) comidaPorId.set(c.id, c)

  const todosLosItems = Array.from(comidaPorId.values()).flatMap((c) => c.plan_comida_items ?? [])
  const itemsResueltosPorComida = new Map<string, { tipo: string; nombre: string; cantidadGramos: number | null }[]>()
  if (comidaPorId.size > 0) {
    const nombrePorAlimentoId = await (async () => {
      const alimentoIds = Array.from(new Set(todosLosItems.filter((i) => i.tipo === 'alimento' && i.alimento_id).map((i) => String(i.alimento_id))))
      const mapa = new Map<string, string>()
      if (alimentoIds.length > 0) {
        const { data } = await db.from('vademecum_alimentos').select('id, nombre').in('id', alimentoIds)
        for (const a of data ?? []) mapa.set(String(a.id), a.nombre)
      }
      return mapa
    })()
    for (const c of Array.from(comidaPorId.values())) {
      itemsResueltosPorComida.set(c.id, (c.plan_comida_items ?? [])
        .sort(compararItems)
        .map((item) => ({
          tipo: item.tipo,
          nombre: item.tipo === 'alimento' && item.alimento_id
            ? (nombrePorAlimentoId.get(String(item.alimento_id)) ?? 'Alimento sin nombre cargado')
            : (item.contenido_texto ?? ''),
          cantidadGramos: item.cantidad_gramos,
        })))
    }
  }

  const horaActual = horaActualAR()
  let hechas = 0
  let total = 0

  const grilla = filas.map((tipoComida) => ({
    tipoComida,
    hora: horaPorTipo.get(tipoComida) ?? null,
    celdas: dias.map((fecha) => {
      const dia = diaSemanaKey(fecha)
      const comidaDelDia = comidaPorDiaYTipo.get(`${dia}|${tipoComida}`) ?? null
      const registro = registroPorFechaYTipo.get(`${fecha}|${tipoComida}`) ?? null

      if (!comidaDelDia && !registro) {
        return { estado: 'no_aplica' as const }
      }

      if (registro) {
        total++; hechas++
        const comidaHistorica = registro.plan_comida_id ? comidaPorId.get(registro.plan_comida_id) ?? null : null
        return {
          estado: 'registro' as const,
          registro: {
            id: registro.id,
            registradoAt: registro.registrado_at,
            comentario: registro.comentario,
            fotoVencida: registro.foto_vencida,
          },
          plan: comidaHistorica
            ? { cambiado: false as const, hora: comidaHistorica.hora, nota: comidaHistorica.nota, items: itemsResueltosPorComida.get(comidaHistorica.id) ?? [] }
            : { cambiado: true as const },
        }
      }

      // sin registro: due depende de la comida vigente de ese día
      const due = comidaDelDia ? esDue(fecha, hoy, comidaDelDia.hora, horaActual) : false
      if (!due) return { estado: 'fut' as const }

      total++
      return {
        estado: 'miss' as const,
        plan: comidaDelDia
          ? { cambiado: false as const, hora: comidaDelDia.hora, nota: comidaDelDia.nota, items: itemsResueltosPorComida.get(comidaDelDia.id) ?? [] }
          : { cambiado: true as const },
      }
    }),
  }))

  const diasRetencion = await diasRetencionPorPlan(db, profile?.plan ?? null)

  return NextResponse.json({
    semanaInicio: dias[0],
    semanaFin: dias[6],
    dias,
    esSemanaActual: lunes === lunesActual,
    puedeRetroceder: lunes > lunesMinimo,
    filas: grilla,
    contador: { hechas, total },
    diasRetencion,
  })
}
