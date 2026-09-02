import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

const PUBLIC_ROUTES = [
  '/login',
  '/registro',
  '/recuperar',
  '/nueva-contrasena',
  '/p',
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
  '/colaboradora/activar',
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
  // Bypass middleware for API routes and OPTIONS preflight
  if (request.method === 'OPTIONS' || request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const pathname = request.nextUrl.pathname

  // '/' es ahora un client component que resuelve su propio redirect (lee
  // el hash de tokens de invitación de colaboradora antes de decidir a
  // dónde ir) — no usamos PUBLIC_ROUTES acá porque ese array matchea con
  // .startsWith() y '/' rompería la protección de todas las rutas.
  if (pathname === '/') {
    return NextResponse.next()
  }

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

  // Caso especial: admin.generateLink() de Supabase a veces ignora el
  // redirectTo que le pasamos y cae al Site URL a secas (bug documentado:
  // supabase/supabase#10469, #22562). Cuando eso pasa, el link de invitación
  // de colaboradora aterriza acá, en la raíz, con el código de sesión como
  // query param — sin este intercept, el chequeo de !user de más abajo la
  // rebotaría a /login antes de que el código se intercambie.
  const inviteCode = request.nextUrl.searchParams.get('code')
  if (pathname === '/' && inviteCode) {
    const { data: exchangeData } = await supabase.auth.exchangeCodeForSession(inviteCode)
    const tipoCuenta = exchangeData.session?.user?.user_metadata?.tipo_cuenta
    if (tipoCuenta === 'colaborador') {
      const url = request.nextUrl.clone()
      url.pathname = '/colaboradora/activar'
      url.search = ''
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }
    // Si no es colaboradora (o el exchange falló), no hacemos nada especial
    // acá — dejamos que el flujo normal de abajo siga su curso.
  }

  const { data: { user } } = await supabase.auth.getUser()

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

