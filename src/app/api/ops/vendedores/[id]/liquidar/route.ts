import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getAdminUserTotal() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('admin_users')
    .select('id, rol')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .single()
  return data?.rol === 'total' ? data : null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUserTotal()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { notas?: string }

  // Con el cliente de SESIÓN, nunca el de service_role: ops_liquidar_vendedor
  // es SECURITY DEFINER y valida ella misma auth.email() contra admin_users
  // (rol='total') — pasarle el service client le haría perder esa identidad.
  const supabase = createClient()
  const { data, error } = await supabase.rpc('ops_liquidar_vendedor', {
    p_vendedor_id: params.id,
    p_notas: body.notas || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
