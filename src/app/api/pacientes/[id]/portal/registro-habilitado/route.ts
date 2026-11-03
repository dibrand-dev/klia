import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const habilitado = body?.habilitado
  if (typeof habilitado !== 'boolean') {
    return NextResponse.json({ error: 'habilitado debe ser boolean' }, { status: 400 })
  }

  const db = serviceClient()
  const { data, error } = await db
    .from('paciente_accesos')
    .update({ registro_habilitado: habilitado })
    .eq('paciente_id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .select('paciente_id')

  if (error) {
    console.error('[portal/registro-habilitado] Error actualizando:', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'sin_acceso', message: 'No hay un acceso de portal para este paciente.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
