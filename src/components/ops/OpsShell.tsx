'use client'

import { useState } from 'react'
import Logo from '@/components/ui/Logo'
import OpsSidebar from '@/components/ops/OpsSidebar'
import type { AdminUser } from '@/types/database'

export default function OpsShell({
  adminUser,
  children,
}: {
  adminUser: AdminUser
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Mobile topbar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Abrir menú"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <Logo className="h-8 w-auto" />
      </header>

      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <OpsSidebar adminUser={adminUser} open={open} onClose={() => setOpen(false)} />

      {/* Main content */}
      <main className="md:ml-[260px] min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
