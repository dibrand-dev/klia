import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

export async function GET(
  _req: NextRequest,
  { params }: { params: { paciente_id: string } }
) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data } = await supabase
    .from('admisiones' as never)
    .select('*')
    .eq('paciente_id', params.paciente_id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .single()

  return NextResponse.json({ data: data ?? null })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { paciente_id: string } }
) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>

  const { data: existing } = await supabase
    .from('admisiones' as never)
    .select('id')
    .eq('paciente_id', params.paciente_id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .single()

  const payload = {
    ...body,
    paciente_id: params.paciente_id,
    terapeuta_id: efectivo.terapeutaId,
    updated_at: new Date().toISOString(),
  }

  let result
  if (existing) {
    result = await supabase
      .from('admisiones' as never)
      .update(payload as never)
      .eq('paciente_id', params.paciente_id)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .select()
      .single()
  } else {
    result = await supabase
      .from('admisiones' as never)
      .insert(payload as never)
      .select()
      .single()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data: result.data })
}
