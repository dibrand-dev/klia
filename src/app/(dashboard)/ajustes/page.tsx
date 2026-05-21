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

  const p = profile as Record<string, unknown>

  return (
    <AjustesClient
      profile={profile}
      obrasSociales={obrasSociales ?? []}
      suscripcion={suscripcion ?? null}
      googleConectado={!!googleTokens}
      googleSyncEnabled={googleTokens?.sync_enabled ?? false}
      mpConectado={!!p.mp_user_id}
      mpEmail={(p.mp_email as string | null) ?? null}
      mpNombre={(p.mp_nombre as string | null) ?? null}
      cobrosVentanaHoras={(p.cobros_ventana_horas as number | null) ?? 48}
      cobrosCancelacionHoras={(p.cobros_cancelacion_horas as number | null) ?? 24}
      cobrosPrecioSesion={(p.cobros_precio_sesion as number | null) ?? null}
      cobrosMoneda={(p.cobros_moneda as string | null) ?? 'ARS'}
      cobrosMessagePaciente={(p.cobros_mensaje_paciente as string | null) ?? ''}
    />
  )
}
