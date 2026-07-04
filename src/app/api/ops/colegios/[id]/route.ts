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
  const { nombre, contacto_nombre, contacto_email, fecha_acuerdo, activo } = body

  const updateData: Record<string, unknown> = {}
  if (nombre !== undefined) updateData.nombre = nombre
  if (contacto_nombre !== undefined) updateData.contacto_nombre = contacto_nombre
  if (contacto_email !== undefined) updateData.contacto_email = contacto_email
  if (fecha_acuerdo !== undefined) updateData.fecha_acuerdo = fecha_acuerdo
  if (activo !== undefined) updateData.activo = activo

  const { error } = await serviceClient().from('colegios').update(updateData).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
