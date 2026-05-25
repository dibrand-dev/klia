'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/types/database'
import SidebarUserCard from '@/components/ui/SidebarUserCard'
import Logo from '@/components/ui/Logo'

const NAV_ITEMS = [
  { href: '/ops/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/ops/prestadores', label: 'Prestadores', icon: 'groups' },
  { href: '/ops/facturacion', label: 'Facturación', icon: 'payments' },
  { href: '/ops/obras-sociales', label: 'Obras Sociales', icon: 'health_and_safety' },
  { href: '/ops/planillas', label: 'Plantillas', icon: 'description' },
]

const NAV_ITEMS_TOTAL = [
  { href: '/ops/planes', label: 'Planes', icon: 'workspace_premium' },
  { href: '/ops/modulos', label: 'Módulos', icon: 'extension' },
  { href: '/ops/configuracion', label: 'Configuración', icon: 'settings' },
]

interface Props {
  adminUser: AdminUser
  open?: boolean
  onClose?: () => void
}

export default function OpsSidebar({ adminUser, open, onClose }: Props) {
  const pathname = usePathname()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = 'https://app.klia.com.ar/ops/login'
  }

  const allItems = adminUser.rol === 'total'
    ? [...NAV_ITEMS, ...NAV_ITEMS_TOTAL]
    : NAV_ITEMS

  return (
    <nav className={cn(
      'flex flex-col h-screen fixed left-0 top-0 p-6 z-50 overflow-y-auto bg-surface-container-lowest shadow-[8px_0_24px_rgba(0,26,72,0.06)] w-[260px] rounded-r-xl',
      'transition-transform duration-300 ease-in-out',
      open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    )}>
      {/* Logo + close button (mobile) */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Logo className="h-14 w-auto" />
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mt-1 pl-0.5">Ops</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden mt-1 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
          aria-label="Cerrar menú"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Admin card */}
      <SidebarUserCard
        initials={`${adminUser.nombre[0]}${adminUser.apellido[0]}`}
        name={`${adminUser.nombre} ${adminUser.apellido}`}
        subtitle={adminUser.rol === 'total' ? 'Super Admin' : 'Administrativo'}
      />

      {/* Navigation */}
      <ul className="flex flex-col gap-1 flex-1">
        {allItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-200 active:scale-[0.98]',
                  isActive
                    ? 'bg-surface-container-lowest text-primary font-bold shadow-sm hover:bg-surface-container-low'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                )}
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-outline-variant/20 space-y-1">
        <p className="text-[11px] text-on-surface-variant px-4 pb-1 truncate">{adminUser.email}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-on-surface-variant font-medium px-4 py-3 rounded-lg hover:bg-surface-container-low transition-colors duration-200 active:scale-[0.98] w-full text-left text-sm"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          Salir
        </button>
      </div>
    </nav>
  )
}
