import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { cookieDomainForHost } from './cookie-domain'

export function createClient() {
  const domain = typeof window !== 'undefined' ? cookieDomainForHost(window.location.hostname) : undefined

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    domain ? { cookieOptions: { domain, path: '/' } } : undefined
  )
}
