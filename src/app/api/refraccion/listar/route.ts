import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pacienteId = searchParams.get('pacienteId')
  if (!pacienteId) return NextResponse.json({ error: 'pacienteId requerido' }, { status: 400 })

  const { data: recetas } = await supabase
    .from('registros_refraccion')
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ recetas: recetas ?? [] })
}
