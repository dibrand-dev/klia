import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

// Códigos reales de vademecum_nutrientes.codigo (convención tipo FoodData/USDA).
const NUTRIENTES_CODIGOS = ['ENERC_KCAL', 'PROTCNT', 'FAT', 'CHOCDF'] as const
type NutrienteCodigo = typeof NUTRIENTES_CODIGOS[number]

// Nombres amigables para la respuesta — el consumidor de este endpoint no
// necesita conocer los códigos internos del Vademécum.
const NOMBRE_AMIGABLE: Record<NutrienteCodigo, 'energia' | 'proteinas' | 'grasas' | 'carbohidratos'> = {
  ENERC_KCAL: 'energia',
  PROTCNT: 'proteinas',
  FAT: 'grasas',
  CHOCDF: 'carbohidratos',
}

function totalesVacios(): Record<NutrienteCodigo, number> {
  return { ENERC_KCAL: 0, PROTCNT: 0, FAT: 0, CHOCDF: 0 }
}

function aFormatoAmigable(totales: Record<NutrienteCodigo, number>): Record<'energia' | 'proteinas' | 'grasas' | 'carbohidratos', number> {
  const resultado = { energia: 0, proteinas: 0, grasas: 0, carbohidratos: 0 }
  for (const codigo of NUTRIENTES_CODIGOS) {
    resultado[NOMBRE_AMIGABLE[codigo]] = totales[codigo]
  }
  return resultado
}

// Conteo paralelo, por macro, de cuántos ítems de la comida/día no tienen
// dato real para esa macro puntual (a diferencia de un valor medido en 0).
// Se usa en el frontend para decidir "s/d" vs "0 g": s/d solo cuando NINGÚN
// ítem tiene dato real (sinDato === cantidad de ítems que aportan a esa macro).
function aSinDatoAmigable(counts: Record<NutrienteCodigo, number>): Record<'energiaSinDato' | 'proteinasSinDato' | 'grasasSinDato' | 'carbohidratosSinDato', number> {
  return {
    energiaSinDato: counts.ENERC_KCAL,
    proteinasSinDato: counts.PROTCNT,
    grasasSinDato: counts.FAT,
    carbohidratosSinDato: counts.CHOCDF,
  }
}

type ItemRow = {
  id: string
  comida_id: string
  tipo: string
  contenido_texto: string | null
  alimento_fuente: string | null
  alimento_id: string | null
  cantidad_gramos: number | null
}

type ComidaRow = {
  id: string
  dia_semana: string
  tipo_comida: string
  plan_comida_items: ItemRow[]
}

// dia_semana es texto ('lunes'/'martes'/...), no numérico — mismo orden que
// menu_semanal.dia. Usado solo para ordenar la respuesta Lunes→Domingo.
const ORDEN_DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const { data: plan } = await db
    .from('planes_alimentarios')
    .select('id, plan_comidas(id, dia_semana, tipo_comida, plan_comida_items(*))')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const comidas = (plan.plan_comidas ?? []) as unknown as ComidaRow[]

  // Alimentos argenfood únicos usados en el plan, para una sola consulta a
  // vademecum_alimento_nutrientes en vez de una por item.
  const alimentoIdsArgenfood = new Set<string>()
  const sinDatos: { itemId: string; motivo: string }[] = []

  for (const comida of comidas) {
    for (const item of comida.plan_comida_items ?? []) {
      if (item.tipo !== 'alimento') continue
      if (item.alimento_fuente === 'argenfood' && item.alimento_id) {
        // alimento_id es bigint en la DB — PostgREST lo serializa como string,
        // pero puede llegar como number si el valor vino de otro lado (ej. el
        // body de un POST). Normalizar a string en el único punto de entrada
        // a este Set evita el mismatch de tipo al comparar contra valorPor100g.
        alimentoIdsArgenfood.add(String(item.alimento_id))
      } else if (item.alimento_fuente === 'off') {
        sinDatos.push({ itemId: item.id, motivo: 'Fuente "off" todavía no tiene datos nutricionales cargados' })
      } else {
        sinDatos.push({ itemId: item.id, motivo: 'Fuente de alimento desconocida o sin alimento_id' })
      }
    }
  }

  // valorPor100g[alimento_id][codigo] = valor (por 100g)
  const valorPor100g = new Map<string, Map<NutrienteCodigo, number>>()

  if (alimentoIdsArgenfood.size > 0) {
    // vademecum_alimento_nutrientes guarda el código del nutriente directo en
    // nutriente_codigo (no una FK a vademecum_nutrientes.id) — sin indirección.
    const { data: valores, error: valoresError } = await db
      .from('vademecum_alimento_nutrientes')
      .select('alimento_id, nutriente_codigo, valor')
      .in('alimento_id', Array.from(alimentoIdsArgenfood))
      .in('nutriente_codigo', NUTRIENTES_CODIGOS as unknown as string[])

    if (valoresError) {
      console.error('[planes-alimentarios/[id]/macros] Error consultando vademecum_alimento_nutrientes:', valoresError)
    }

    for (const v of valores ?? []) {
      if (!NUTRIENTES_CODIGOS.includes(v.nutriente_codigo as NutrienteCodigo)) continue
      const codigo = v.nutriente_codigo as NutrienteCodigo
      const alimentoId = String(v.alimento_id)
      if (!valorPor100g.has(alimentoId)) valorPor100g.set(alimentoId, new Map())
      valorPor100g.get(alimentoId)!.set(codigo, v.valor)
    }
  }

  // Por-nutriente: a diferencia de sumarNutrientesItem (todo-o-nada), acá cada
  // macro se resuelve individualmente — un ítem puede tener kcal y proteínas
  // pero no carbohidratos (falta la fila puntual en vademecum_alimento_nutrientes).
  // `null` = sin dato real para esa macro puntual (no es lo mismo que medir 0).
  function macrosItem(item: ItemRow): Record<NutrienteCodigo, number | null> {
    if (item.tipo !== 'alimento' || item.alimento_fuente !== 'argenfood' || !item.alimento_id || item.cantidad_gramos == null) {
      return { ENERC_KCAL: null, PROTCNT: null, FAT: null, CHOCDF: null }
    }
    const valores = valorPor100g.get(String(item.alimento_id))
    const factor = item.cantidad_gramos / 100
    const resultado = {} as Record<NutrienteCodigo, number | null>
    for (const codigo of NUTRIENTES_CODIGOS) {
      const v = valores?.get(codigo)
      resultado[codigo] = v == null ? null : v * factor
    }
    return resultado
  }

  function nuevoAcumulador() {
    return { totales: totalesVacios(), sinDato: { ENERC_KCAL: 0, PROTCNT: 0, FAT: 0, CHOCDF: 0 } as Record<NutrienteCodigo, number> }
  }

  function acumular(acc: ReturnType<typeof nuevoAcumulador>, item: ItemRow) {
    const aporte = macrosItem(item)
    for (const codigo of NUTRIENTES_CODIGOS) {
      const v = aporte[codigo]
      if (v == null) acc.sinDato[codigo] += 1
      else acc.totales[codigo] += v
    }
  }

  const acumuladorPlan = nuevoAcumulador()

  const porDia = comidas
    .map((comida) => {
      const acumuladorComida = nuevoAcumulador()
      const itemsSinDatos: string[] = []

      for (const item of comida.plan_comida_items ?? []) {
        if (item.tipo === 'texto_libre') {
          itemsSinDatos.push(item.id)
        } else if (item.alimento_fuente !== 'argenfood' || !item.alimento_id || item.cantidad_gramos == null) {
          itemsSinDatos.push(item.id)
        }
        acumular(acumuladorComida, item)
        acumular(acumuladorPlan, item)
      }

      return {
        comidaId: comida.id,
        diaSemana: comida.dia_semana,
        tipoComida: comida.tipo_comida,
        totales: { ...aFormatoAmigable(acumuladorComida.totales), ...aSinDatoAmigable(acumuladorComida.sinDato) },
        itemsSinDatosNutricionales: itemsSinDatos,
      }
    })
    .sort((a, b) => ORDEN_DIAS.indexOf(a.diaSemana) - ORDEN_DIAS.indexOf(b.diaSemana))

  // Agregación por día (para el scope "Día" del selector de macros): suma los
  // totales de todas las comidas de cada dia_semana que tenga al menos una.
  const acumuladoresPorDiaSemana = new Map<string, ReturnType<typeof nuevoAcumulador>>()
  for (const comida of comidas) {
    if (!acumuladoresPorDiaSemana.has(comida.dia_semana)) {
      acumuladoresPorDiaSemana.set(comida.dia_semana, nuevoAcumulador())
    }
    const acumulado = acumuladoresPorDiaSemana.get(comida.dia_semana)!
    for (const item of comida.plan_comida_items ?? []) {
      acumular(acumulado, item)
    }
  }

  const porDiaAgregado = ORDEN_DIAS
    .filter((dia) => acumuladoresPorDiaSemana.has(dia))
    .map((dia) => ({
      diaSemana: dia,
      totales: { ...aFormatoAmigable(acumuladoresPorDiaSemana.get(dia)!.totales), ...aSinDatoAmigable(acumuladoresPorDiaSemana.get(dia)!.sinDato) },
    }))

  // Promedio del plan: promedio de los totales diarios sobre la cantidad de
  // días con al menos una comida — no sobre 7, y no recalculado en el cliente.
  // El conteo "sin dato" del promedio se suma (no se promedia) — indica si a
  // lo largo del plan hubo ítems sin esa macro, sin importar en qué día cayeron.
  const diasConDatos = porDiaAgregado.length
  const promedioAcumulado = totalesVacios()
  const sinDatoAcumulado: Record<NutrienteCodigo, number> = { ENERC_KCAL: 0, PROTCNT: 0, FAT: 0, CHOCDF: 0 }
  acumuladoresPorDiaSemana.forEach((acc, dia) => {
    if (!ORDEN_DIAS.includes(dia)) return
    for (const codigo of NUTRIENTES_CODIGOS) {
      promedioAcumulado[codigo] += acc.totales[codigo]
      sinDatoAcumulado[codigo] += acc.sinDato[codigo]
    }
  })
  if (diasConDatos > 0) {
    for (const codigo of NUTRIENTES_CODIGOS) {
      promedioAcumulado[codigo] = promedioAcumulado[codigo] / diasConDatos
    }
  }

  return NextResponse.json({
    planId: params.id,
    porDia,
    total: { ...aFormatoAmigable(acumuladorPlan.totales), ...aSinDatoAmigable(acumuladorPlan.sinDato) },
    avisos: sinDatos,
    porDiaAgregado,
    promedioPlan: {
      diasConDatos,
      totales: { ...aFormatoAmigable(promedioAcumulado), ...aSinDatoAmigable(sinDatoAcumulado) },
    },
  })
}
