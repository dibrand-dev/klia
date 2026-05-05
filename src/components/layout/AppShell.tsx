'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Paciente } from '@/types/database'
import GlobalFooter from './GlobalFooter'
import NavigationDrawer from './NavigationDrawer'
import SlideOver from '@/components/ui/SlideOver'
import Logo from '@/components/ui/Logo'
import NuevoTurnoPageForm from '@/components/agenda/NuevoTurnoPageForm'
import NuevaNotaForm from '@/components/pacientes/NuevaNotaForm'

function TrialBanner({ trialFin }: { trialFin: string }) {
  const [dias, setDias] = useState<number | null>(null)
  useEffect(() => {
    setDias(Math.max(0, Math.ceil((new Date(trialFin).getTime() - Date.now()) / 86400000)))
  }, [trialFin])

  if (dias === null) return null

  const urgente = dias <= 5
  return (
    <div className={`w-full text-center text-xs py-2 px-4 font-medium ${urgente ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'}`}>
      {dias === 0
        ? '⚠️ Tu período de prueba vence hoy. Activá tu suscripción para no perder el acceso.'
        : `⏳ Período de prueba: ${dias} día${dias === 1 ? '' : 's'} restante${dias === 1 ? '' : 's'}.`}
      {' '}
      <Link href="/planes" className="underline font-semibold">
        Contratar ahora
      </Link>
    </div>
  )
}

export default function AppShell({
  profile,
  children,
}: {
  profile: Profile | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [nuevoTurnoOpen, setNuevoTurnoOpen] = useState(false)
  const [nuevoPacienteId, setNuevoPacienteId] = useState<string | undefined>(undefined)
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [pacientesCargados, setPacientesCargados] = useState(false)
  const [nuevaNotaOpen, setNuevaNotaOpen] = useState(false)
  const [notaPacienteId, setNotaPacienteId] = useState<string>('')

  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add('mobile-sidebar-open')
    } else {
      document.body.classList.remove('mobile-sidebar-open')
    }
  }, [mobileOpen])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  async function abrirNuevoTurno(pacienteId?: string) {
    if (!pacientesCargados && profile) {
      const supabase = createClient()
      const { data } = await supabase
        .from('pacientes')
        .select('*')
        .eq('terapeuta_id', profile.id)
        .eq('activo', true)
        .order('apellido')
      setPacientes(data ?? [])
      setPacientesCargados(true)
    }
    setNuevoPacienteId(pacienteId)
    setNuevoTurnoOpen(true)
  }

  useEffect(() => {
    function handler(e: Event) {
      const pacienteId = (e as CustomEvent<{ pacienteId?: string }>).detail?.pacienteId
      abrirNuevoTurno(pacienteId)
    }
    window.addEventListener('openNuevoTurno', handler)
    return () => window.removeEventListener('openNuevoTurno', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacientesCargados, profile])

  useEffect(() => {
    function handler(e: Event) {
      const pacienteId = (e as CustomEvent<{ pacienteId: string }>).detail?.pacienteId
      if (pacienteId) { setNotaPacienteId(pacienteId); setNuevaNotaOpen(true) }
    }
    window.addEventListener('openNuevaNotaClinica', handler)
    return () => window.removeEventListener('openNuevaNotaClinica', handler)
  }, [])

  return (
    <>
      {/* Mobile top header */}
      <div className="fixed top-0 left-0 w-full h-16 bg-white border-b border-outline-variant/30 flex items-center px-4 z-50 md:hidden">
        <button
          className="p-2 hover:bg-slate-100 rounded-lg"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <Link href="/dashboard" className="ml-4">
          <Logo className="h-7 w-auto" />
        </Link>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[90] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Navigation Drawer */}
      <NavigationDrawer profile={profile} onNuevaSesion={abrirNuevoTurno} />

      {/* Main content */}
      <main
        id="main-content"
        className="flex flex-col min-h-screen md:ml-[260px] pt-16 md:pt-0"
      >
        {profile?.estado_cuenta === 'trial' && profile.trial_fin
          ? <TrialBanner trialFin={profile.trial_fin} />
          : null}
        <div className="flex-1">
          {children}
        </div>
        <GlobalFooter />
      </main>

      {/* Mobile FAB */}
      <button
        onClick={() => abrirNuevoTurno()}
        className="fixed bottom-8 right-8 h-14 w-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 md:hidden"
        aria-label="Nueva sesión"
      >
        <span className="material-symbols-outlined">add</span>
      </button>

      {/* SlideOver global de nueva nota clínica */}
      <SlideOver
        open={nuevaNotaOpen}
        onClose={() => setNuevaNotaOpen(false)}
        title="Nueva nota clínica"
      >
        <NuevaNotaForm
          key={nuevaNotaOpen ? notaPacienteId : 'closed'}
          pacienteId={notaPacienteId}
          onCreada={() => { setNuevaNotaOpen(false); router.refresh() }}
          onClose={() => setNuevaNotaOpen(false)}
        />
      </SlideOver>

      {/* SlideOver global de nuevo turno */}
      <SlideOver
        open={nuevoTurnoOpen}
        onClose={() => setNuevoTurnoOpen(false)}
        title="Nuevo turno"
      >
        <Suspense fallback={null}>
          <NuevoTurnoPageForm
            key={nuevoTurnoOpen ? `open-${nuevoPacienteId ?? ''}` : 'closed'}
            pacientes={pacientes}
            terapeutaId={profile?.id ?? ''}
            pacienteIdInicial={nuevoPacienteId}
            onCreado={() => { setNuevoTurnoOpen(false); router.refresh() }}
            onClose={() => setNuevoTurnoOpen(false)}
          />
        </Suspense>
      </SlideOver>
    </>
  )
}
