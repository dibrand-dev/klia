'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/ui/Logo'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (!accessToken || !refreshToken) {
      router.replace('https://www.klia.com.ar/login?error=auth_callback_error')
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        if (error || !data.session) {
          router.replace('https://www.klia.com.ar/login?error=auth_callback_error')
          return
        }

        if (type === 'recovery') {
          router.replace('/nueva-contrasena')
          return
        }

        // signup: profile already created by handle_new_user trigger
        // send welcome email async then redirect
        fetch('/api/emails/bienvenida', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.session.user.id }),
        }).catch(() => {})

        router.replace('/bienvenida')
      })
      .catch(() => {
        router.replace('https://www.klia.com.ar/login?error=auth_callback_error')
      })
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#F5F6FA', gap: 24,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <Logo className="h-8 w-auto opacity-80" />
      <p style={{ fontSize: 14, color: '#8A93A1', margin: 0 }}>Confirmando tu cuenta...</p>
    </div>
  )
}
