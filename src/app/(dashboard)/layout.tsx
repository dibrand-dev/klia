import { redirect } from 'next/navigation'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'
import { getModulosConfig } from '@/lib/modulos'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { obtenerDatosAgendaTurno } from '@/lib/agenda/datosAgendaTurno'
import type { Database } from '@/types/database'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

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

  const db = serviceClient()
  const { sedesActivas, tiposTurno, tiposTurnoHabilitado } = await obtenerDatosAgendaTurno(db, efectivo.terapeutaId, profile.plan ?? '')

  return (
    <>
      {/* Zoho SalesIQ — solo acá, nunca en el layout raíz: visible únicamente
          para el profesional autenticado, nunca en /login, /registro, /ops
          ni en el portal público de reservas (/p/[slug], que no tiene
          layout propio y hereda solo el raíz). */}
      <Script id="zsiq-init" strategy="afterInteractive">
        {`window.$zoho=window.$zoho || {};$zoho.salesiq=$zoho.salesiq||{ready:function(){}}`}
      </Script>
      <Script
        id="zsiqscript"
        src="https://salesiq.zohopublic.com/widget?wc=siq195479a499f719dd02043e3c9eb1e5e6"
        strategy="afterInteractive"
      />
      <AppShell
        profile={profile}
        modulos={modulos}
        tiposTurno={tiposTurno}
        tiposTurnoHabilitado={tiposTurnoHabilitado}
        sedesParaTurno={sedesActivas}
      >{children}</AppShell>
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
