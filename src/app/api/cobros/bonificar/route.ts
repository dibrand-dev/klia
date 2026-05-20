import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { turno_id } = await req.json() as { turno_id: string }

  if (!turno_id) {
    return NextResponse.json({ error: 'Falta turno_id' }, { status: 400 })
  }

  // Get turno to know the monto
  const { data: turno, error: turnoError } = await supabase
    .from('turnos')
    .select('id, monto')
    .eq('id', turno_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (turnoError || !turno) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  const { error } = await supabase
    .from('turnos')
    .update({
      estado_pago: 'bonificado',
      monto_pagado: turno.monto ?? 0,
      pagado: false,
    })
    .eq('id', turno_id)
    .eq('terapeuta_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
