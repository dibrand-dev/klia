import type { NextRequest } from 'next/server'

// Dominios conocidos de la app: producción y el alias de rama estable de
// staging en Vercel (a diferencia de la URL de Preview por deployment, que
// cambia en cada push, el alias de rama "git-staging" es fijo). Nunca se
// confía en NEXT_PUBLIC_APP_URL para esto — esa env var está pensada para
// links compartidos con terceros (plan alimentario), no para construir
// redirectTo de auth, y en Preview no puede representar una URL por
// deployment de todas formas.
const DOMINIOS_PERMITIDOS = [
  'https://app.klia.com.ar',
  'https://klin-app-git-staging-dibrand-devs-projects.vercel.app',
]
const FALLBACK = 'https://app.klia.com.ar'

// Resuelve la URL base (origin) a usar para construir links de auth
// (redirectTo de generateLink, redirects de /auth/callback) a partir del
// request real — nunca de un header sin validar: el origin se compara
// contra una lista cerrada de dominios conocidos, y si no matchea cae al
// fallback de producción. Así un Preview de staging genera links que
// vuelven a staging, y producción nunca cambia de comportamiento.
export function resolverBaseUrl(request: NextRequest | Request): string {
  const origin = new URL(request.url).origin
  return DOMINIOS_PERMITIDOS.includes(origin) ? origin : FALLBACK
}
