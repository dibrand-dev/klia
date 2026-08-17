'use client'

import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = process.env.NEXT_PUBLIC_APP_ENV === 'staging' ? '/login' : 'https://app.klia.com.ar/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
    >
      Cerrar sesión
    </button>
  )
}
