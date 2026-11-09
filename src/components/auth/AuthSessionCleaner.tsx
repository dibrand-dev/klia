'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { limpiarCookiesSesionDuplicadas } from '@/lib/supabase/cookie-domain'

export function AuthSessionCleaner() {
  useEffect(() => {
    limpiarCookiesSesionDuplicadas()
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
            // scope 'local': solo limpia este navegador. El default ('global')
            // revocaba también las sesiones recién creadas en otros dispositivos.
            await supabase.auth.signOut({ scope: 'local' })
          }
        }
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  return null
}
