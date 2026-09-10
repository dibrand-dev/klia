import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { SEDE_LIMITS } from '@/lib/sedes/horarios'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('modulos_config')
    .select('modulo_id, nombre, descripcion, planes')
    .eq('activo', true)
    .order('modulo_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Para el módulo "sedes", el límite por plan mostrado al público sale de
  // SEDE_LIMITS (la misma constante que aplica el límite real en el sistema),
  // para que el número en /precios nunca pueda desincronizarse del límite real.
  const result = (data ?? []).map((modulo) => {
    if (modulo.modulo_id !== 'sedes') return modulo
    const limitePorPlan = Object.fromEntries(
      Object.entries(SEDE_LIMITS).map(([plan, limite]) => [
        plan,
        limite === Infinity ? 'Ilimitadas' : String(limite),
      ])
    )
    return { ...modulo, limitePorPlan }
  })

  return NextResponse.json(result)
}
