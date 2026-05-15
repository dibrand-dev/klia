import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AdminUser } from '@/types/database'

export async function requireAdminUser(): Promise<AdminUser> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/ops/login')

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .single()

  if (!adminUser) redirect('/ops/login')
  return adminUser
}
