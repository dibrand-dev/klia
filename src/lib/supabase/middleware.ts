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
  '/pagar',
  '/cuenta-bloqueada',
  '/checkout',
  '/terminos',
  '/privacidad',
]

// Routes that require a specific module to be enabled for the professional's plan
const MODULE_PATHS: Record<string, string> = {
  '/atenciones': 'atenciones',
  '/cobros': 'cobros',
  '/facturacion': 'facturacion',
  '/informes': 'informes',
}

function getModuloFromPath(pathname: string): string | null {
  const entry = Object.entries(MODULE_PATHS).find(([path]) => pathname.startsWith(path))
  return entry?.[1] ?? null
}

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

  console.log('🔵 MW path:', pathname)
  console.log('🔵 MW user:', user?.email ?? 'null')
  console.log('🔵 MW cookies:', request.cookies.getAll().map(c => c.name).join(', '))

  // /auth/* routes handle their own authentication internally
  if (pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // /ops routes have their own admin auth guard (requireAdminUser) — skip profile checks
  if (pathname.startsWith('/ops/') && !pathname.startsWith('/ops/login')) {
    return supabaseResponse
  }

  const isAuthRoute = pathname.startsWith('/login') ||
    pathname.startsWith('/registro')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Page-level checks (skip API routes and ops)
  if (user && !isAuthRoute && !pathname.startsWith('/cuenta-bloqueada') && !pathname.startsWith('/api/') && !pathname.startsWith('/ops/')) {
    const moduloId = getModuloFromPath(pathname)

    const [{ data: profile }, { data: modulos }] = await Promise.all([
      supabase.from('profiles').select('estado_cuenta, plan').eq('id', user.id).single(),
      moduloId
        ? supabase.from('modulos_config').select('modulo_id, planes').eq('activo', true)
        : Promise.resolve({ data: null }),
    ])

    if (profile?.estado_cuenta === 'bloqueada') {
      const url = request.nextUrl.clone()
      url.pathname = '/cuenta-bloqueada'
      return NextResponse.redirect(url)
    }

    if (moduloId && modulos && profile?.plan) {
      const modulo = modulos.find((m: { modulo_id: string; planes: string[] }) => m.modulo_id === moduloId)
      if (modulo && !modulo.planes.includes(profile.plan)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

