import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BienvenidaClient from './BienvenidaClient'

export default async function BienvenidaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, trial_fin')
    .eq('id', user.id)
    .single()

  return (
    <BienvenidaClient
      nombre={profile?.nombre ?? ''}
      trialFin={profile?.trial_fin ?? ''}
    />
  )
}
