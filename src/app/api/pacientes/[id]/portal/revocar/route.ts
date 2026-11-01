import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { revocarAccesoPaciente } from '@/lib/portal/invitacion'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const resultado = await revocarAccesoPaciente(params.id, efectivo.terapeutaId)

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, message: resultado.message }, { status: resultado.status })
  }

  return NextResponse.json({ ok: true })
}
