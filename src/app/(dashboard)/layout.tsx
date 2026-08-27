import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import dynamic from 'next/dynamic'
import { getModulosConfig } from '@/lib/modulos'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'

const AppShell = dynamic(
  () => import('@/components/layout/AppShell'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAFBFC',
      }}>
        <div style={{ color: '#001a48', fontSize: 14 }}>Cargando...</div>
      </div>
    ),
  }
)

const OnboardingWizard = dynamic(
  () => import('@/components/onboarding/OnboardingWizard'),
  { ssr: false }
)


export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) redirect('/login')

  const [{ data: profile }, modulos] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', efectivo.terapeutaId).single(),
    getModulosConfig(supabase),
  ])

  if (!profile) redirect('/login')

  // Auto-bloquear si el trial venció
  if (profile.estado_cuenta === 'trial' && profile.trial_fin && new Date(profile.trial_fin) < new Date()) {
    await supabase.from('profiles').update({ estado_cuenta: 'bloqueada' }).eq('id', efectivo.terapeutaId)
    redirect('/cuenta-bloqueada')
  }

  if (profile.estado_cuenta === 'bloqueada' || profile.estado_cuenta === 'cancelada') {
    redirect('/cuenta-bloqueada')
  }

  const showOnboarding = !efectivo.esColaborador && !profile.onboarding_completed && !profile.onboarding_skipped

  return (
    <>
      <AppShell profile={profile} modulos={modulos}>{children}</AppShell>
      {showOnboarding && (
        <OnboardingWizard
          nombreProfesional={profile.nombre}
          initialMatricula={profile.matricula}
          initialTelefono={profile.telefono}
          initialProvincia={profile.provincia}
          initialMaxStepReached={profile.onboarding_max_step_reached}
          initialEspecialidad={profile.especialidad}
        />
      )}
    </>
  )
}
