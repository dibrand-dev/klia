import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PerfilProfesional from '@/components/ajustes/PerfilProfesional'
import HorarioAgendaConfig from '@/components/ajustes/HorarioAgendaConfig'
import PoliticaCobrosConfig from '@/components/ajustes/PoliticaCobrosConfig'

export const metadata = { title: 'Ajustes — KLIA' }

export default async function AjustesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 md:px-7 pt-6 md:pt-8 pb-20">
      <h1 className="text-2xl font-bold text-on-surface mb-2">Ajustes</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Configurá tu perfil profesional. Esta información es visible para colegas en la solapa de Interconsultas.
      </p>

      <div className="mb-8 space-y-3">
        <Link
          href="/ajustes/integraciones"
          className="flex items-center gap-4 bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all group"
        >
          <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>extension</span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-on-surface">Integraciones</p>
            <p className="text-xs text-on-surface-variant">Conectá KLIA con Google Calendar y otras herramientas</p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">chevron_right</span>
        </Link>
        <Link
          href="/ajustes/suscripcion"
          className="flex items-center gap-4 bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all group"
        >
          <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>credit_card</span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-on-surface">Suscripción y plan</p>
            <p className="text-xs text-on-surface-variant">Ver tu plan actual, cambiar de plan o cancelar tu suscripción</p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">chevron_right</span>
        </Link>
        <Link
          href="/ajustes/obras-sociales"
          className="flex items-center gap-4 bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all group"
        >
          <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>health_and_safety</span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-on-surface">Obras Sociales</p>
            <p className="text-xs text-on-surface-variant">Configurá honorarios y datos de cada obra social para liquidaciones</p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">chevron_right</span>
        </Link>
        <Link
          href="/ajustes/firmas"
          className="flex items-center gap-4 bg-white rounded-2xl border border-outline-variant/20 shadow-sm px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all group"
        >
          <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>draw</span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-on-surface">Firmas digitales</p>
            <p className="text-xs text-on-surface-variant">Configurá tu firma y sello para planillas y documentos</p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">chevron_right</span>
        </Link>
      </div>

      <PoliticaCobrosConfig cobrarInasistenciasInicial={profile?.cobrar_inasistencias ?? false} />

      <HorarioAgendaConfig profile={profile} />

      <PerfilProfesional profile={profile} />
    </div>
  )
}
