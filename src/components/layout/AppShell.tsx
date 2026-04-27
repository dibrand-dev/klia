'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile } from '@/types/database'
import GlobalFooter from './GlobalFooter'
import NavigationDrawer from './NavigationDrawer'

function TrialBanner({ trialFin }: { trialFin: string }) {
  const dias = Math.max(0, Math.ceil((new Date(trialFin).getTime() - Date.now()) / 86400000))
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
  const [mobileOpen, setMobileOpen] = useState(false)

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
        <div className="ml-4 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-primary text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            medical_services
          </span>
          <span className="font-bold text-xl text-primary tracking-tighter">KLIA</span>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[90] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Navigation Drawer */}
      <NavigationDrawer profile={profile} />

      {/* Main content */}
      <main
        id="main-content"
        className="flex flex-col min-h-screen md:ml-[260px] pt-16 md:pt-0"
      >
        {profile?.estado_cuenta === 'trial' && profile.trial_fin && (
          <TrialBanner trialFin={profile.trial_fin} />
        )}
        <div className="flex-1">
          {children}
        </div>
        <GlobalFooter />
      </main>

      {/* Mobile FAB */}
      <Link
        href="/turnos/nuevo"
        className="fixed bottom-8 right-8 h-14 w-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 md:hidden"
      >
        <span className="material-symbols-outlined">add</span>
      </Link>
    </>
  )
}
