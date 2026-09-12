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
  dia_semana: number
  tipo_comida: string
  plan_comida_items: ItemRow[]
}

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
        alimentoIdsArgenfood.add(item.alimento_id)
      } else if (item.alimento_fuente === 'off') {
        sinDatos.push({ itemId: item.id, motivo: 'Fuente "off" todavía no tiene datos nutricionales cargados' })
      } else {
        sinDatos.push({ itemId: item.id, motivo: 'Fuente de alimento desconocida o sin alimento_id' })
      }
    }
  }

  // valorPor100g[alimento_id][codigo] = valor_nutriente (por 100g)
  const valorPor100g = new Map<string, Map<NutrienteCodigo, number>>()

  if (alimentoIdsArgenfood.size > 0) {
    const { data: nutrientes } = await db
      .from('vademecum_nutrientes')
      .select('id, codigo')
      .in('codigo', NUTRIENTES_CODIGOS as unknown as string[])

    const idPorCodigo = new Map<string, NutrienteCodigo>()
    for (const n of nutrientes ?? []) {
      if (NUTRIENTES_CODIGOS.includes(n.codigo as NutrienteCodigo)) {
        idPorCodigo.set(n.id, n.codigo as NutrienteCodigo)
      }
    }

    const { data: valores } = await db
      .from('vademecum_alimento_nutrientes')
      .select('alimento_id, nutriente_id, valor_nutriente')
      .in('alimento_id', Array.from(alimentoIdsArgenfood))

    for (const v of valores ?? []) {
      const codigo = idPorCodigo.get(v.nutriente_id)
      if (!codigo) continue
      if (!valorPor100g.has(v.alimento_id)) valorPor100g.set(v.alimento_id, new Map())
      valorPor100g.get(v.alimento_id)!.set(codigo, v.valor_nutriente)
    }
  }

  function sumarNutrientesItem(item: ItemRow): Record<NutrienteCodigo, number> | null {
    if (item.tipo !== 'alimento' || item.alimento_fuente !== 'argenfood' || !item.alimento_id || item.cantidad_gramos == null) {
      return null
    }
    const valores = valorPor100g.get(item.alimento_id)
    if (!valores) return null
    const factor = item.cantidad_gramos / 100
    const resultado = totalesVacios()
    for (const codigo of NUTRIENTES_CODIGOS) {
      resultado[codigo] = (valores.get(codigo) ?? 0) * factor
    }
    return resultado
  }

  const totalPlan = totalesVacios()

  const porDia = comidas
    .map((comida) => {
      const totalComida = totalesVacios()
      const itemsSinDatos: string[] = []

      for (const item of comida.plan_comida_items ?? []) {
        if (item.tipo === 'texto_libre') {
          itemsSinDatos.push(item.id)
          continue
        }
        const aporte = sumarNutrientesItem(item)
        if (!aporte) {
          itemsSinDatos.push(item.id)
          continue
        }
        for (const codigo of NUTRIENTES_CODIGOS) {
          totalComida[codigo] += aporte[codigo]
          totalPlan[codigo] += aporte[codigo]
        }
      }

      return {
        comidaId: comida.id,
        diaSemana: comida.dia_semana,
        tipoComida: comida.tipo_comida,
        totales: aFormatoAmigable(totalComida),
        itemsSinDatosNutricionales: itemsSinDatos,
      }
    })
    .sort((a, b) => a.diaSemana - b.diaSemana)

  return NextResponse.json({
    planId: params.id,
    porDia,
    total: aFormatoAmigable(totalPlan),
    avisos: sinDatos,
  })
}
