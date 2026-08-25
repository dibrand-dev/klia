'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    async function resolver() {
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const supabase = createClient()
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (!error && data.session?.user?.user_metadata?.tipo_cuenta === 'colaborador') {
            router.replace('/colaboradora/activar')
            return
          }
        }
      }

      const res = await fetch('/api/auth/home-redirect')
      const { redirect } = await res.json() as { redirect: string }
      router.replace(redirect)
    }

    resolver()
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F6FA' }}>
      <p style={{ fontSize: 14, color: '#7a7f8a' }}>Cargando...</p>
    </div>
  )
}
