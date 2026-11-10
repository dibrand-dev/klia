import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { cookieDomainForHost } from './cookie-domain'

// Bases sin barra final — esRutaPublica() matchea por segmento completo
// (pathname === base, o pathname.startsWith(base + '/')), nunca por prefijo
// suelto. Bug real cazado en QA: '/p' con startsWith() sin límite de
// segmento matcheaba también '/pacientes' (y todo /pacientes/*), dejando
// esa ruta de profesional completamente pública — nunca llegaba ni a la
// Capa 1 ni a la Capa 2 de más abajo.
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
  '/checkout',
  '/terminos',
  '/privacidad',
  '/colaboradora/activar',
  '/turno',
  '/vendedor/login',
  // '/cuenta-bloqueada' NO va acá (antes sí estaba): tiene que pasar por la
  // Capa 1 para que una cuenta de paciente la redirija a /portal en vez de
  // poder verla (no tiene "estado_cuenta bloqueada" — ese concepto es
  // exclusivo de profiles). La Capa 2 la excluye de re-chequear
  // estado_cuenta para no loopear contra sí misma cuando la Capa 2 ya
  // redirigió ahí.
  // Portal del paciente: /activar lee los tokens del hash de la URL del lado
  // del cliente (igual que /colaboradora/activar) — el server nunca ve ese
  // hash, así que tiene que ser pública. /login es el login propio del
  // portal, mismo trato que /login a secas.
  '/portal/activar',
  '/portal/login',
]

function esRutaPublica(pathname: string): boolean {
  return PUBLIC_ROUTES.some((base) => pathname === base || pathname.startsWith(`${base}/`))
}

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
  if (esRutaPublica(pathname)) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })
  const cookieDomain = cookieDomainForHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'))

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
            supabaseResponse.cookies.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options)
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
    // Esto es solo una pista de a dónde mandar al usuario a terminar de
    // activarse — user_metadata la puede editar el propio usuario desde el
    // cliente, así que nunca se usa para autorizar nada, solo para elegir
    // el destino del redirect acá.
    if (tipoCuenta === 'colaborador' || tipoCuenta === 'paciente') {
      const url = request.nextUrl.clone()
      url.pathname = tipoCuenta === 'colaborador' ? '/colaboradora/activar' : '/portal/activar'
      url.search = ''
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }
    // Si no es colaboradora/paciente (o el exchange falló), no hacemos nada
    // especial acá — dejamos que el flujo normal de abajo siga su curso.
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Capa 1 — barrera temprana para cuentas de paciente, SIN consulta a
  // profiles: se decide solo por app_metadata (nunca user_metadata, que el
  // propio usuario puede editar desde el cliente con auth.updateUser).
  // Corre ANTES que los bypass de /auth/ y /ops/ de más abajo a propósito:
  // esos bypass existen para que /auth/* y /ops/* resuelvan su propia
  // autenticación sin pasar por el chequeo de profiles — pero antes de esta
  // capa, ese mismo bypass dejaba pasar a una cuenta de paciente a /ops/* o
  // /cuenta-bloqueada sin ningún control, porque esas rutas nunca llegaban
  // a la Capa 2 (su guard vive más abajo, adentro del bloque que ellas
  // mismas bypassean). Esta capa es una lista permitida explícita — no una
  // cadena de exclusiones — así que cubre cualquier ruta nueva por diseño,
  // sin tener que acordarse de agregarla.
  if (user?.app_metadata?.tipo_cuenta === 'paciente') {
    const permitido = pathname.startsWith('/portal') || pathname.startsWith('/auth/') || pathname === '/logout'
    if (!permitido) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Capa 1 — misma lógica que la de paciente arriba, para cuentas de
  // vendedor (panel de comisiones de colegios/vendedores). Igual que ahí,
  // se decide solo por app_metadata (nunca user_metadata).
  if (user?.app_metadata?.tipo_cuenta === 'vendedor') {
    const permitido = pathname.startsWith('/vendedor') || pathname.startsWith('/auth/') || pathname === '/logout'
    if (!permitido) {
      const url = request.nextUrl.clone()
      url.pathname = '/vendedor'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // /auth/* routes handle their own authentication internally
  if (pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // /ops routes have their own admin auth guard (requireAdminUser) — skip profile checks
  if (pathname.startsWith('/ops/') && !pathname.startsWith('/ops/login')) {
    return supabaseResponse
  }

  // /vendedor routes (salvo login, ya público arriba) tienen su propio guard
  // (requireVendedor) — a diferencia de /ops, acá sí chequeamos user en el
  // middleware mismo: sin sesión, directo a /vendedor/login.
  if (pathname === '/vendedor' || pathname.startsWith('/vendedor/')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/vendedor/login'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const isAuthRoute = pathname.startsWith('/login') ||
    pathname.startsWith('/registro')
  const esRutaPortal = pathname === '/portal' || pathname.startsWith('/portal/')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = esRutaPortal ? '/portal/login' : '/login'
    return NextResponse.redirect(url)
  }

  // Capa 2 — el resto de las rutas de página (profesional/colaboradora) con
  // perfil en `profiles`. Por diseño, ninguna cuenta de paciente llega hasta
  // acá para una ruta fuera de /portal/* (la Capa 1 ya la mandó de vuelta),
  // así que esto es una segunda red — no depende de la Capa 1 para ser
  // correcto, por si en algún momento una cuenta queda sin profiles por otro
  // motivo que no sea el portal del paciente.
  //
  // Lista permitida explícita de las rutas que SÍ necesitan este chequeo —
  // las que quedan afuera (api, ops, cuenta-bloqueada, auth) ya resuelven su
  // propia autenticación por su cuenta, arriba o en su propio código.
  const RUTAS_CON_GUARD_PROPIO = ['/api/', '/ops/', '/cuenta-bloqueada', '/vendedor/']
  const necesitaChequeoDePerfil = !isAuthRoute && !RUTAS_CON_GUARD_PROPIO.some((p) => pathname.startsWith(p))

  if (user && necesitaChequeoDePerfil) {
    const moduloId = getModuloFromPath(pathname)

    const [{ data: profile }, { data: modulos }] = await Promise.all([
      supabase.from('profiles').select('estado_cuenta, plan').eq('id', user.id).single(),
      moduloId
        ? supabase.from('modulos_config').select('modulo_id, planes').eq('activo', true)
        : Promise.resolve({ data: null }),
    ])

    // Sin fila en profiles = cuenta de portal del paciente (u otra cuenta sin
    // perfil de profesional) — nunca se decide por user_metadata, que el
    // usuario puede editar desde el cliente con auth.updateUser(); la
    // ausencia de fila en profiles (ya la consultamos arriba, sin query
    // extra) es la única señal server-side confiable acá. Solo puede ver
    // /portal/*.
    if (!profile) {
      if (!esRutaPortal) {
        const url = request.nextUrl.clone()
        url.pathname = '/portal'
        url.search = ''
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }

    // Tiene perfil de profesional (o colaboradora) — el portal del paciente
    // no es para esta cuenta.
    if (esRutaPortal) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (profile.estado_cuenta === 'bloqueada') {
      const url = request.nextUrl.clone()
      url.pathname = '/cuenta-bloqueada'
      return NextResponse.redirect(url)
    }

    if (moduloId && modulos && profile.plan) {
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

