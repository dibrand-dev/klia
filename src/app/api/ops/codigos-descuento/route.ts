import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getAdminUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .single()
  return data ?? null
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { colegio_id, codigo, porcentaje_descuento, usos_maximos, activo } = body

  if (!colegio_id || typeof colegio_id !== 'string') {
    return NextResponse.json({ error: 'El colegio es obligatorio' }, { status: 400 })
  }
  if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
    return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 })
  }
  const porcentaje = Number(porcentaje_descuento)
  if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
    return NextResponse.json({ error: 'El porcentaje de descuento debe estar entre 1 y 100' }, { status: 400 })
  }

  const { error } = await serviceClient().from('codigos_descuento').insert({
    colegio_id,
    codigo: codigo.trim().toUpperCase(),
    porcentaje_descuento: porcentaje,
    usos_maximos: usos_maximos != null ? Number(usos_maximos) : null,
    activo: activo ?? true,
  })

  if (error) {
    const msg = error.code === '23505' ? 'Ya existe un código con ese nombre' : error.message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
