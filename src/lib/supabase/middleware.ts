import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/auth/callback',
  '/auth/redirect',
  '/bienvenida',
  '/ops/login',
  '/planes',
  '/cuenta-bloqueada',
  '/checkout',
  '/terminos',
  '/privacidad',
]

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Si es ruta pública → pasar directamente sin llamar a Supabase
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // /auth/* routes handle their own authentication internally
  if (pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  const isAuthRoute = pathname.startsWith('/login') ||
    pathname.startsWith('/registro')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect blocked accounts to the paused-access page (page routes only)
  if (user && !isAuthRoute && !pathname.startsWith('/cuenta-bloqueada') && !pathname.startsWith('/api/') && !pathname.startsWith('/ops/')) {
    const { data: profileStatus } = await supabase
      .from('profiles')
      .select('estado_cuenta')
      .eq('id', user.id)
      .single()
    if (profileStatus?.estado_cuenta === 'bloqueada') {
      const url = request.nextUrl.clone()
      url.pathname = '/cuenta-bloqueada'
      return NextResponse.redirect(url)
    }
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
