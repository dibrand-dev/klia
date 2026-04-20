'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const NAV_ITEMS = [
  { href: '/agenda', label: 'Agenda', icon: 'calendar_today' },
  { href: '/pacientes', label: 'Pacientes', icon: 'groups' },
  { href: '/facturacion', label: 'Facturación', icon: 'payments' },
  { href: '/informes', label: 'Informes', icon: 'description' },
  { href: '/ajustes', label: 'Ajustes', icon: 'settings' },
]

export default function NavigationDrawer({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

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
    <nav
      id="sidebar"
      className="flex flex-col h-screen fixed left-0 top-0 p-6 z-40 overflow-y-auto bg-surface-container-lowest shadow-[8px_0_24px_rgba(0,26,72,0.06)] w-[260px] rounded-r-xl"
    >
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <span
          className="material-symbols-outlined text-primary text-3xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          medical_services
        </span>
        <span className="text-primary font-bold text-xl tracking-tighter">KLIA</span>
      </div>

      {/* User Profile Card */}
      <div className="bg-surface-container-low mb-6 p-4 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center font-bold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-primary truncate">
            {profile ? `${profile.nombre} ${profile.apellido}` : 'Usuario'}
          </p>
          <p className="text-xs text-on-surface-variant truncate">
            {profile?.especialidad || profile?.email || ''}
          </p>
        </div>
      </div>

      {/* Navigation Menu */}
      <ul className="flex flex-col gap-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'flex items-center gap-3 bg-surface-container-lowest text-primary font-bold rounded-lg px-4 py-3 shadow-sm hover:bg-surface-container-low transition-colors duration-200 active:scale-[0.98]'
                    : 'flex items-center gap-3 text-on-surface-variant font-medium px-4 py-3 rounded-lg hover:bg-surface-container-low transition-colors duration-200 active:scale-[0.98]'
                }
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="text-sm">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Action Button */}
      <div className="mt-8 mb-6">
        <Link
          href="/turnos/nuevo"
          className="w-full bg-primary text-on-primary font-medium text-sm px-4 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-container transition-colors duration-200 shadow-sm active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Nueva Sesión
        </Link>
      </div>

      {/* Logout */}
      <div className="mt-auto pt-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-on-surface-variant font-medium px-4 py-3 rounded-lg hover:bg-surface-container-low transition-colors duration-200 active:scale-[0.98] w-full text-left"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          <span className="text-sm">Cerrar sesión</span>
        </button>
      </div>
    </nav>
  )
}
