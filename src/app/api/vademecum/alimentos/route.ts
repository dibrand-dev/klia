import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const LIMITE = 40

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const idsParam = request.nextUrl.searchParams.get('ids')?.trim() ?? ''
  const db = serviceClient()

  // Modo batch: reconstruir macros de alimentos ya elegidos (al cargar un plan
  // existente), sin límite de 40 ni búsqueda por nombre.
  let query = db.from('vademecum_alimentos').select('id, fuente, nombre')

  if (idsParam) {
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    query = query.in('id', ids)
  } else {
    query = query.order('nombre').limit(LIMITE)
    if (q) query = query.ilike('nombre', `%${q}%`)
  }

  const { data: alimentos, error } = await query

  if (error) {
    console.error('[vademecum/alimentos] DB error:', error)
    return NextResponse.json({ error: 'Error al buscar alimentos' }, { status: 500 })
  }

  const ids = (alimentos ?? []).map((a) => a.id)
  const NUTRIENTES_CODIGOS = ['ENERC_KCAL', 'PROTCNT', 'FAT', 'CHOCDF'] as const
  const macrosPorAlimento = new Map<string, Record<string, number>>()

  if (ids.length > 0) {
    const { data: valores } = await db
      .from('vademecum_alimento_nutrientes')
      .select('alimento_id, nutriente_codigo, valor')
      .in('nutriente_codigo', NUTRIENTES_CODIGOS as unknown as string[])
      .in('alimento_id', ids)

    for (const v of valores ?? []) {
      const alimentoId = String(v.alimento_id)
      if (!macrosPorAlimento.has(alimentoId)) macrosPorAlimento.set(alimentoId, {})
      macrosPorAlimento.get(alimentoId)![v.nutriente_codigo] = v.valor
    }
  }

  const resultado = (alimentos ?? []).map((a) => {
    const macros = macrosPorAlimento.get(String(a.id)) ?? {}
    return {
      id: a.id,
      fuente: a.fuente,
      nombre: a.nombre,
      kcalPor100g: macros.ENERC_KCAL ?? null,
      proteinasPor100g: macros.PROTCNT ?? null,
      grasasPor100g: macros.FAT ?? null,
      carbohidratosPor100g: macros.CHOCDF ?? null,
    }
  })

  return NextResponse.json({ alimentos: resultado })
}
