import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { calcularMacrosPlan } from '@/lib/planes-alimentarios/macros'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const macros = await calcularMacrosPlan(db, params.id, efectivo.terapeutaId)

  if (!macros) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  return NextResponse.json(macros)
}
