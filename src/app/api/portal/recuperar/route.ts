import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { enviarEmail } from '@/lib/brevo'
import { emailRecuperacionContrasena } from '@/lib/email-templates'
import { resolverBaseUrl } from '@/lib/urls'

export const runtime = 'nodejs'

const TIEMPO_MINIMO_MS = 400

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Mismo patrón anti-enumeración que /api/auth/recuperar (profesionales):
// siempre responde { ok: true }, nunca revela si el email existe. A
// diferencia de esa ruta, solo genera el link si el email corresponde a una
// cuenta de portal del paciente (app_metadata.tipo_cuenta — nunca
// user_metadata, que el usuario puede editar desde el cliente). Pre-sesión,
// igual que /api/portal/activar — no hay acceso activo todavía que validar
// con accesoHabilitado.
export async function POST(req: NextRequest) {
  const inicio = Date.now()
  const body = await req.json().catch(() => null) as { email?: string } | null
  const email = body?.email?.trim()

  if (email) {
    const db = serviceClient()
    const { data: acceso } = await db
      .from('paciente_accesos')
      .select('auth_user_id, pacientes(nombre)')
      .eq('email', email)
      .not('auth_user_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (acceso?.auth_user_id) {
      const { data: userData } = await db.auth.admin.getUserById(acceso.auth_user_id)
      if (userData?.user?.app_metadata?.tipo_cuenta === 'paciente') {
        const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: `${resolverBaseUrl(req)}/auth/callback?type=recovery` },
        })

        if (!linkError && linkData?.properties?.action_link) {
          const nombre = (acceso.pacientes as unknown as { nombre: string } | null)?.nombre || 'paciente'
          // Se espera el envío (no fire-and-forget): en una function serverless
          // la ejecución puede cortarse apenas se devuelve la respuesta, y el
          // mail nunca saldría. El piso de tiempo mínimo de abajo igual
          // compensa el caso "no existe" para no filtrar por timing.
          try {
            await enviarEmail({
              destinatario: email,
              nombreDestinatario: nombre,
              asunto: 'Recuperá tu contraseña en KLIA',
              htmlContent: emailRecuperacionContrasena(nombre, linkData.properties.action_link),
            })
          } catch (emailError) {
            console.error('[portal/recuperar] Error enviando email:', emailError)
          }
        } else if (linkError) {
          console.error('[portal/recuperar] Error generando link:', linkError)
        }
      }
    }
  }

  const transcurrido = Date.now() - inicio
  if (transcurrido < TIEMPO_MINIMO_MS) await sleep(TIEMPO_MINIMO_MS - transcurrido)

  return NextResponse.json({ ok: true })
}
