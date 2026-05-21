import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AjustesClient from '@/components/ajustes/AjustesClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ajustes — KLIA' }

export default async function AjustesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: obrasSociales },
    { data: suscripcion },
    { data: googleTokens },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('profesional_obras_sociales').select('*').eq('terapeuta_id', user.id).order('nombre'),
    supabase.from('suscripciones').select('estado, plan, modalidad, suscripcion_fin, mp_preapproval_id, monto').eq('terapeuta_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('google_calendar_tokens').select('sync_enabled').eq('terapeuta_id', user.id).maybeSingle(),
  ])

  if (!profile) redirect('/login')

  return (
    <AjustesClient
      profile={profile}
      obrasSociales={obrasSociales ?? []}
      suscripcion={suscripcion ?? null}
      googleConectado={!!googleTokens}
      googleSyncEnabled={googleTokens?.sync_enabled ?? false}
    />
  )
}
