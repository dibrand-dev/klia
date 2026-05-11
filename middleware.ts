import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Ejecutar middleware SOLO en rutas que necesitan auth.
     * Excluir explícitamente:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - Archivos con extensión (png, jpg, svg, css, js, etc.)
     * - Rutas públicas conocidas
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.*|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|map)|api/cron|api/suscripcion/webhook).*)',
  ],
}
