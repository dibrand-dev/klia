import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 10

// Telemetría de errores de foto del portal (compresión/subida) — sin
// pathnames, sin comentarios, sin ids de paciente, sin la imagen. Solo para
// diagnosticar fallas por navegador/dispositivo (ver console.error).
// Permanente: corre también en producción.

// Rate limit simple en memoria por usuario — alcanza para contener un bucle
// de reintentos del cliente; se resetea en cada cold start de la función,
// no es un límite estricto entre instancias ni hace falta que lo sea acá.
const VENTANA_MS = 60_000
const MAX_POR_VENTANA = 10
const intentosPorUsuario = new Map<string, { count: number; desde: number }>()

function limitado(userId: string): boolean {
  const ahora = Date.now()
  const entry = intentosPorUsuario.get(userId)
  if (!entry || ahora - entry.desde > VENTANA_MS) {
    intentosPorUsuario.set(userId, { count: 1, desde: ahora })
    return false
  }
  entry.count++
  return entry.count > MAX_POR_VENTANA
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.tipo_cuenta !== 'paciente') {
    return new NextResponse(null, { status: 403 })
  }

  if (!limitado(user.id)) {
    const body = await req.json().catch(() => null) as {
      etapa?: string
      nombreError?: string
      mensaje?: string
      userAgent?: string
      tipoArchivo?: string
      bytes?: number
      ancho?: number
      alto?: number
    } | null

    if (body) {
      console.error('[portal-foto]', {
        etapa: String(body.etapa ?? '').slice(0, 60),
        nombreError: String(body.nombreError ?? '').slice(0, 60),
        mensaje: String(body.mensaje ?? '').slice(0, 200),
        userAgent: String(body.userAgent ?? '').slice(0, 200),
        tipoArchivo: String(body.tipoArchivo ?? '').slice(0, 60),
        bytes: typeof body.bytes === 'number' ? body.bytes : null,
        ancho: typeof body.ancho === 'number' ? body.ancho : null,
        alto: typeof body.alto === 'number' ? body.alto : null,
      })
    }
  }

  return new NextResponse(null, { status: 204 })
}
