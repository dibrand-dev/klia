'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import SidebarUserCard from '@/components/ui/SidebarUserCard'
import Logo from '@/components/ui/Logo'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar_today' },
  { href: '/pacientes', label: 'Pacientes', icon: 'groups' },
  {
    href: '/facturacion/liquidacion', label: 'Facturación', icon: 'payments',
    children: [{ href: '/facturacion/liquidacion', label: 'Liquidación OS' }],
  },
  { href: '/informes', label: 'Informes', icon: 'description' },
  { href: '/ajustes', label: 'Ajustes', icon: 'settings' },
]

export default function NavigationDrawer({ profile, onNuevaSesion }: { profile: Profile | null; onNuevaSesion: () => void }) {
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
      <Link href="/dashboard" className="mb-8 block">
        <Logo className="h-9 w-auto" />
      </Link>

      {/* User Profile Card */}
      <SidebarUserCard
        initials={initials}
        name={profile ? `${profile.nombre} ${profile.apellido}` : 'Usuario'}
        subtitle={profile?.especialidad || profile?.email || ''}
      />

      {/* Navigation Menu */}
      <ul className="flex flex-col gap-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href.split('/')[1] ? '/' + item.href.split('/')[1] : item.href)
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
              {'children' in item && item.children && isActive && (
                <ul className="ml-10 mt-1 space-y-1">
                  {item.children.map(child => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className={`block text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          pathname === child.href || pathname.startsWith(child.href)
                            ? 'text-primary font-semibold'
                            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                        }`}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {/* Action Button */}
      <div className="mt-8 mb-6">
        <button
          onClick={onNuevaSesion}
          className="w-full bg-primary text-on-primary font-medium text-sm px-4 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-container transition-colors duration-200 shadow-sm active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Nueva Sesión
        </button>
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
