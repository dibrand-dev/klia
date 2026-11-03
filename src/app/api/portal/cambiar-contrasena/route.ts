import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'

export const runtime = 'nodejs'

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  // Mismo contrato que el resto de /api/portal/* (ver acceso.ts): esta ruta
  // actúa sobre una sesión ya activa, así que sí pasa por accesoPrincipal —
  // a diferencia de activar/recuperar/invitacion-info, que corren antes de
  // que exista un acceso activo.
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

  const body = await req.json().catch(() => null) as { actual?: string; nueva?: string } | null
  const actual = body?.actual
  const nueva = body?.nueva

  if (!actual || !nueva) {
    return NextResponse.json({ error: 'faltan_datos', message: 'Completá la contraseña actual y la nueva.' }, { status: 400 })
  }
  if (!PASSWORD_REGEX.test(nueva)) {
    return NextResponse.json({ error: 'contrasena_invalida', message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.' }, { status: 400 })
  }

  // Cliente efímero SIN persistencia de sesión — signInWithPassword en el
  // cliente normal pisaría las cookies de la sesión actual del usuario.
  const clienteVerificacion = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error: authError } = await clienteVerificacion.auth.signInWithPassword({ email: user.email, password: actual })
  if (authError) {
    return NextResponse.json({ error: 'contrasena_actual_incorrecta', message: 'La contraseña actual no es correcta.' }, { status: 401 })
  }

  const { error: updateError } = await db.auth.admin.updateUserById(user.id, { password: nueva })
  if (updateError) {
    console.error('[portal/cambiar-contrasena] Error actualizando:', updateError)
    return NextResponse.json({ error: 'Error al actualizar la contraseña' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
