'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthSessionCleaner() {
  useEffect(() => {
    const supabase = createClient()

    // Limpiar sesión inválida cuando hay error de refresh token
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Si no hay sesión pero hay un token en las cookies, significa que es inválido
        // Necesitamos limpiar las cookies para evitar el loop infinito de refresh
        if (event === 'INITIAL_SESSION' && !session) {
          const { data } = await supabase.auth.getSession()
          if (!data.session) {
            // Sign out para limpiar las cookies inválidas
            await supabase.auth.signOut()
          }
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  return null
}
