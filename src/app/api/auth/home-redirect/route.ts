import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ redirect: '/login' })
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .maybeSingle()

  if (adminUser) {
    return NextResponse.json({ redirect: '/ops/dashboard' })
  }

  return NextResponse.json({ redirect: '/dashboard' })
}
