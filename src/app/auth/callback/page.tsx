'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const handleCallback = async () => {
      const hash = window.location.hash
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const type = params.get('type') || new URLSearchParams(hash.slice(1)).get('type')

      console.log('🔵 CALLBACK hash:', hash.substring(0, 100))
      console.log('🔵 CALLBACK search:', window.location.search)
      console.log('🔵 CALLBACK code presente:', !!code, '| type:', type)

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.log('🔵 CALLBACK ERROR exchangeCodeForSession:', JSON.stringify(error))
          router.replace('https://www.klia.com.ar/login?error=auth_callback_error')
          return
        }
      } else if (hash && hash.includes('access_token')) {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
          console.log('🔵 CALLBACK ERROR getSession:', JSON.stringify(error))
          router.replace('https://www.klia.com.ar/login?error=auth_callback_error')
          return
        }
      } else {
        console.log('🔵 CALLBACK ERROR: ni code ni access_token')
        router.replace('https://www.klia.com.ar/login?error=auth_callback_error')
        return
      }

      // Recovery flow — session established, redirect to password reset form
      if (type === 'recovery') {
        router.replace('/nueva-contrasena')
        return
      }

      // Session established — check if admin or new user
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('https://www.klia.com.ar/login?error=auth_callback_error')
        return
      }

      // Check if admin
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', session.user.email ?? '')
        .eq('activo', true)
        .maybeSingle()

      if (adminUser) {
        router.replace('/ops/dashboard')
        return
      }

      // Check if new user (no trial_fin set)
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_fin, nombre, apellido')
        .eq('id', session.user.id)
        .single()

      if (!profile?.trial_fin) {
        const trialFin = new Date()
        trialFin.setDate(trialFin.getDate() + 21)

        const meta = session.user.user_metadata ?? {}
        const googleFullName: string = meta.full_name || meta.name || ''
        const googleGivenName: string = meta.given_name || googleFullName.split(' ')[0] || ''
        const googleFamilyName: string = meta.family_name || googleFullName.split(' ').slice(1).join(' ') || ''
        const googleAvatar: string | null = meta.avatar_url || meta.picture || null

        const { error: updateError } = await supabase.from('profiles').update({
          plan: 'premium',
          estado_cuenta: 'trial',
          trial_inicio: new Date().toISOString(),
          trial_fin: trialFin.toISOString(),
          ...(googleGivenName && !profile?.nombre && { nombre: googleGivenName }),
          ...(googleFamilyName && !profile?.apellido && { apellido: googleFamilyName }),
          ...(googleAvatar && { avatar_url: googleAvatar }),
        }).eq('id', session.user.id)

        // Send welcome email
        fetch('/api/emails/bienvenida', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id }),
        }).catch(() => {})

        router.replace('/bienvenida')
        return
      }

      router.replace('/dashboard')
    }

    handleCallback()
  }, [router])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, border: '4px solid #001a48',
        borderTopColor: 'transparent', borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <p style={{ color: '#444651', fontSize: 14 }}>Verificando tu cuenta...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
