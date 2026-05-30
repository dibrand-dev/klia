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
  const {
    plan, estado_cuenta, trial_fin,
    nombre, apellido, especialidad, matricula,
    telefono, pais, provincia, localidad, direccion,
  } = body

  const updateData: Record<string, unknown> = {}
  if (nombre !== undefined) updateData.nombre = nombre
  if (apellido !== undefined) updateData.apellido = apellido
  if (especialidad !== undefined) updateData.especialidad = especialidad
  if (matricula !== undefined) updateData.matricula = matricula
  if (telefono !== undefined) updateData.telefono = telefono
  if (pais !== undefined) updateData.pais = pais
  if (provincia !== undefined) updateData.provincia = provincia
  if (localidad !== undefined) updateData.localidad = localidad
  if (direccion !== undefined) updateData.direccion = direccion
  if (plan !== undefined) updateData.plan = plan
  if (estado_cuenta !== undefined) updateData.estado_cuenta = estado_cuenta
  if (trial_fin !== undefined) updateData.trial_fin = trial_fin

  const { error } = await serviceClient()
    .from('profiles')
    .update(updateData)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await serviceClient().auth.admin.deleteUser(params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

