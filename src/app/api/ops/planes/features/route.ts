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

// GET — features for a plan
export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const plan_id = req.nextUrl.searchParams.get('plan_id')
  if (!plan_id) return NextResponse.json({ error: 'plan_id requerido' }, { status: 400 })

  const { data, error } = await serviceClient()
    .from('plan_features')
    .select('*')
    .eq('plan_id', plan_id)
    .order('orden', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — create feature
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { plan_id?: string; texto?: string; incluido?: boolean; orden?: number }
  if (!body.plan_id || !body.texto) {
    return NextResponse.json({ error: 'plan_id y texto son requeridos' }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from('plan_features')
    .insert({
      plan_id: body.plan_id,
      texto: body.texto.trim(),
      incluido: body.incluido ?? true,
      orden: body.orden ?? 99,
      activo: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — update feature
export async function PATCH(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { id?: string; texto?: string; incluido?: boolean; orden?: number; activo?: boolean }
  if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.texto !== undefined) updates.texto = body.texto.trim()
  if (body.incluido !== undefined) updates.incluido = body.incluido
  if (body.orden !== undefined) updates.orden = body.orden
  if (body.activo !== undefined) updates.activo = body.activo

  const { error } = await serviceClient()
    .from('plan_features')
    .update(updates)
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove feature
export async function DELETE(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await serviceClient()
    .from('plan_features')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
