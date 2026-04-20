'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import GlobalFooter from './GlobalFooter'

const NAV_ITEMS = [
  { href: '/agenda', label: 'Agenda', icon: 'calendar_today' },
  { href: '/pacientes', label: 'Pacientes', icon: 'group' },
  { href: '/facturacion', label: 'Facturación', icon: 'payments' },
  { href: '/informes', label: 'Informes', icon: 'description' },
  { href: '/ajustes', label: 'Ajustes', icon: 'settings' },
]

export default function AppShell({
  profile,
  children,
}: {
  profile: Profile | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed')
    } else {
      document.body.classList.remove('sidebar-collapsed')
    }
  }, [collapsed])

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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile
    ? `${profile.nombre?.[0] ?? ''}${profile.apellido?.[0] ?? ''}`.toUpperCase()
    : 'U'

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
          <span className="material-symbols-outlined text-primary text-2xl font-bold">clinical_notes</span>
          <span className="font-black text-xl text-primary tracking-tighter">KLIA</span>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[90] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar"
        className="fixed left-0 top-0 h-screen w-64 p-4 flex flex-col gap-2 bg-white border-r border-outline-variant/30 z-[100]"
      >
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 py-3 border-b border-outline-variant/30">
            <div className="flex items-center gap-2 flex-none px-1">
              <span className="material-symbols-outlined text-primary text-2xl font-bold">clinical_notes</span>
              <span className="sidebar-label font-black text-xl text-primary tracking-tighter">KLIA</span>
            </div>
            <button
              className="ml-auto h-8 w-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors flex-none"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileOpen(false)
                } else {
                  setCollapsed((v) => !v)
                }
              }}
              title="Colapsar / Expandir"
            >
              <span className="material-symbols-outlined text-slate-400 text-lg">menu_open</span>
            </button>
          </div>

          {/* User profile */}
          <div className="mt-4 px-1 sidebar-header-info">
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-outline-variant/10">
              <div className="h-9 w-9 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold border border-white shadow-sm flex-none">
                {initials}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-primary leading-tight truncate">
                  {profile ? `${profile.nombre} ${profile.apellido}` : 'Usuario'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {profile?.especialidad || profile?.email || ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 w-full text-left',
                  isActive
                    ? 'text-primary bg-primary-fixed/30 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <span className="material-symbols-outlined text-lg flex-none">
                  {item.icon}
                </span>
                <span className="text-sm sidebar-label">{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={handleLogout}
            className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 w-full text-left text-slate-600 hover:bg-slate-100 mt-2"
          >
            <span className="material-symbols-outlined text-lg flex-none">logout</span>
            <span className="text-sm sidebar-label">Cerrar sesión</span>
          </button>
        </nav>

        {/* Nueva Sesión CTA */}
        <div className="mt-auto">
          <Link
            href="/turnos/nuevo"
            className="w-full bg-primary hover:bg-primary-container text-white py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 overflow-hidden"
          >
            <span className="material-symbols-outlined text-sm flex-none">add</span>
            <span className="sidebar-label">Nueva Sesión</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main
        id="main-content"
        className={cn(
          'min-h-screen flex flex-col pt-20 pb-0 px-4 md:pt-8 md:px-8 transition-[margin] duration-200',
          collapsed ? 'md:ml-[72px]' : 'md:ml-64',
        )}
      >
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
