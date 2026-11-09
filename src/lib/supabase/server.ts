import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import type { Database } from '@/types/database'
import { cookieDomainForHost } from './cookie-domain'

export function createClient() {
  const cookieStore = cookies()
  const domain = cookieDomainForHost(headers().get('x-forwarded-host') ?? headers().get('host'))

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, domain ? { ...options, domain } : options)
            )
          } catch {
            // En Server Components no se puede setear cookies; se ignora
          }
        },
      },
    }
  )
}
