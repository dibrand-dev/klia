import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  await supabase.from('profiles').update({
    mp_access_token: null,
    mp_refresh_token: null,
    mp_user_id: null,
    mp_email: null,
    mp_nombre: null,
    mp_token_expiry: null,
  } as never).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
