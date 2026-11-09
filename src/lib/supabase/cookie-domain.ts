// La sesión de Supabase se comparte entre www.klia.com.ar (login, repo
// klia-landing) y app.klia.com.ar (esta app). La landing escribe la cookie con
// Domain=.klia.com.ar; si la app la escribe sin Domain queda una segunda cookie
// "host-only" con el mismo nombre, y el servidor puede leer la vieja (refresh
// token ya usado → sesión revocada → vuelta a /login sin mensaje). Por eso
// todos los clientes de la app usan el mismo Domain que la landing.
//
// Solo se aplica en hosts de klia.com.ar: en staging (*.vercel.app) o
// localhost el navegador rechazaría una cookie con ese Domain.
export const COOKIE_DOMAIN = '.klia.com.ar'

export function cookieDomainForHost(host?: string | null): string | undefined {
  const h = (host ?? '').split(':')[0].toLowerCase()
  return h === 'klia.com.ar' || h.endsWith('.klia.com.ar') ? COOKIE_DOMAIN : undefined
}

const AUTH_COOKIE = /^sb-[a-z0-9]+-auth-token(\.\d+)?$/i

// Limpieza de cookies host-only heredadas (escritas por la app antes del fix).
// Solo en el navegador. Un `document.cookie` con Max-Age=0 y SIN Domain expira
// únicamente la cookie host-only, nunca la de Domain=.klia.com.ar. Se actúa
// solo cuando el mismo nombre aparece 2+ veces en document.cookie (señal de que
// conviven las dos); con una sola copia no se toca nada, así no se desloguea a
// quien tiene una sesión válida.
export function limpiarCookiesSesionDuplicadas(): void {
  if (typeof document === 'undefined') return
  if (!cookieDomainForHost(window.location.hostname)) return

  const cuenta: Record<string, number> = {}
  for (const parte of document.cookie.split(';')) {
    const nombre = parte.split('=')[0].trim()
    if (AUTH_COOKIE.test(nombre)) cuenta[nombre] = (cuenta[nombre] ?? 0) + 1
  }
  for (const [nombre, veces] of Object.entries(cuenta)) {
    if (veces > 1) {
      document.cookie = `${nombre}=; Max-Age=0; Path=/; SameSite=Lax; Secure`
    }
  }
}
