import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { reenviarInvitacionPaciente } from '@/lib/portal/invitacion'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, apellido')
    .eq('id', efectivo.terapeutaId)
    .single()

  const nombreProfesional = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'Tu profesional'

  const resultado = await reenviarInvitacionPaciente({
    pacienteId: params.id,
    terapeutaId: efectivo.terapeutaId,
    nombreProfesional,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, message: resultado.message }, { status: resultado.status })
  }

  return NextResponse.json({ ok: true, emailEnviado: resultado.emailEnviado ?? true })
}
