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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { colegio_id, codigo, porcentaje_descuento, usos_maximos, activo } = body

  const updateData: Record<string, unknown> = {}
  if (colegio_id !== undefined) updateData.colegio_id = colegio_id
  if (codigo !== undefined) updateData.codigo = String(codigo).toUpperCase()
  if (porcentaje_descuento !== undefined) {
    const porcentaje = Number(porcentaje_descuento)
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
      return NextResponse.json({ error: 'El porcentaje de descuento debe estar entre 1 y 100' }, { status: 400 })
    }
    updateData.porcentaje_descuento = porcentaje
  }
  if (usos_maximos !== undefined) updateData.usos_maximos = usos_maximos != null ? Number(usos_maximos) : null
  if (activo !== undefined) updateData.activo = activo

  const { error } = await serviceClient().from('codigos_descuento').update(updateData).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
