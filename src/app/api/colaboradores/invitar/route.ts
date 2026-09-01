import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crearInvitacionColaborador } from '@/lib/colaboradores/invitacion'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, nombre, apellido')
    .eq('id', user.id)
    .single()

  if (profile?.plan !== 'premium') {
    return NextResponse.json(
      { error: 'Necesitás el plan Premium para invitar colaboradoras' },
      { status: 403 },
    )
  }

  const { email, nombre } = await req.json() as { email?: string; nombre?: string }
  if (!email) {
    return NextResponse.json({ error: 'Falta email' }, { status: 400 })
  }

  const nombreProfesional = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'Tu profesional'

  const resultado = await crearInvitacionColaborador({
    profesionalId: user.id,
    nombreProfesional,
    email,
    nombre,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, message: resultado.message }, { status: resultado.status })
  }

  return NextResponse.json({ ok: true })
}
