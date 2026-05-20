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

  // Check if cobros exist for this turno
  const { count, error: countError } = await supabase
    .from('cobros')
    .select('id', { count: 'exact', head: true })
    .eq('turno_id', turno_id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar un turno con cobros registrados. Primero eliminá los cobros.' },
      { status: 400 }
    )
  }

  // Mark turno as cancelled (soft delete)
  const { error } = await supabase
    .from('turnos')
    .update({ estado: 'cancelado' })
    .eq('id', turno_id)
    .eq('terapeuta_id', user.id)
    .in('estado', ['realizado', 'no_asistio'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
