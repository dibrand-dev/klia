import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AuthRedirectPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('activo')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .maybeSingle()

  if (adminUser) redirect('/ops/dashboard')
  redirect('/dashboard')
}
