'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// TEMPORAL — solo para poder cambiar de cuenta durante las pruebas de esta fase.
export default function PortalLogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/portal/login')
  }

  return (
    <button onClick={handleLogout} style={{ marginTop: 16 }}>
      Cerrar sesión
    </button>
  )
}
