import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const paciente_id = searchParams.get('paciente_id')
  const mes = searchParams.get('mes')
  const anio = searchParams.get('anio')

  if (!paciente_id || !mes || !anio) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sesiones_declaradas')
    .select('id, fecha, hora_entrada, hora_salida')
    .eq('terapeuta_id', user.id)
    .eq('paciente_id', paciente_id)
    .eq('mes', parseInt(mes))
    .eq('anio', parseInt(anio))
    .order('fecha')
    .order('hora_entrada')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sesiones: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { paciente_id, mes, anio, sesiones } = await req.json() as {
    paciente_id: string
    mes: number
    anio: number
    sesiones: { fecha: string; hora_entrada: string; hora_salida: string }[]
  }

  if (!paciente_id || !mes || !anio) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  // Delete existing for this patient/month
  const { error: delError } = await supabase
    .from('sesiones_declaradas')
    .delete()
    .eq('terapeuta_id', user.id)
    .eq('paciente_id', paciente_id)
    .eq('mes', mes)
    .eq('anio', anio)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  // Insert new ones
  if (sesiones.length > 0) {
    const rows = sesiones.map((s) => ({
      terapeuta_id: user.id,
      paciente_id,
      mes,
      anio,
      fecha: s.fecha,
      hora_entrada: s.hora_entrada,
      hora_salida: s.hora_salida,
    }))
    const { error: insError } = await supabase.from('sesiones_declaradas').insert(rows)
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
