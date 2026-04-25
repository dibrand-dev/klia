'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/types/database'

const NAV_ITEMS = [
  { href: '/ops/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/ops/prestadores', label: 'Prestadores', icon: 'groups' },
  { href: '/ops/facturacion', label: 'Facturación', icon: 'payments' },
  { href: '/ops/obras-sociales', label: 'Obras Sociales', icon: 'health_and_safety' },
]

const NAV_ITEMS_TOTAL = [
  { href: '/ops/planes', label: 'Planes', icon: 'workspace_premium' },
  { href: '/ops/configuracion', label: 'Configuración', icon: 'settings' },
]

export default function OpsSidebar({ adminUser }: { adminUser: AdminUser }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const allItems = adminUser.rol === 'total'
    ? [...NAV_ITEMS, ...NAV_ITEMS_TOTAL]
    : NAV_ITEMS

  return (
    <nav className="flex flex-col h-screen fixed left-0 top-0 p-6 z-40 overflow-y-auto bg-surface-container-lowest shadow-[8px_0_24px_rgba(0,26,72,0.06)] w-[260px] rounded-r-xl">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <span
          className="material-symbols-outlined text-primary text-3xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          admin_panel_settings
        </span>
        <div>
          <span className="text-primary font-bold text-xl tracking-tighter">KLIA</span>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block -mt-0.5">Ops</span>
        </div>
      </div>

      {/* Admin card */}
      <div className="bg-surface-container-low mb-6 p-4 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
          {adminUser.nombre[0]}{adminUser.apellido[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-primary truncate">
            {adminUser.nombre} {adminUser.apellido}
          </p>
          <p className="text-xs text-on-surface-variant truncate capitalize">
            {adminUser.rol === 'total' ? 'Super Admin' : 'Administrativo'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <ul className="flex flex-col gap-1 flex-1">
        {allItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <li key={item.href}>
              <Link
                href={item.href}
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
