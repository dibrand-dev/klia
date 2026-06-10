import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { contenido_generado: string }
  if (!body.contenido_generado) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const { error } = await supabase
    .from('informes_medicos' as never)
    .update({ contenido_generado: body.contenido_generado } as never)
    .eq('id', params.id)
    .eq('terapeuta_id', user.id)
    .eq('estado', 'borrador')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { error } = await supabase
    .from('informes_medicos' as never)
    .delete()
    .eq('id', params.id)
    .eq('terapeuta_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
