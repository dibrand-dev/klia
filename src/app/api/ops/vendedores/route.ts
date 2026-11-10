import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailRecuperacionContrasena } from '@/lib/email-templates'
import { resolverBaseUrl } from '@/lib/urls'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Alta de vendedor es exclusiva de Super Admin ('total') — a diferencia de
// /api/ops/colegios, que deja pasar a cualquier admin activo.
async function getAdminUserTotal() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('admin_users')
    .select('id, rol')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .single()
  return data?.rol === 'total' ? data : null
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUserTotal()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { nombre?: string; apellido?: string; email?: string; colegio_id?: string }
  const { nombre, apellido, email, colegio_id } = body

  if (!nombre?.trim() || !apellido?.trim() || !email?.trim() || !colegio_id) {
    return NextResponse.json({ error: 'nombre, apellido, email y colegio_id son requeridos' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: userData, error: createError } = await db.auth.admin.createUser({
    email: email.trim(),
    user_metadata: { tipo_cuenta: 'vendedor', nombre: nombre.trim(), apellido: apellido.trim() },
    app_metadata: { tipo_cuenta: 'vendedor' },
    email_confirm: true,
  })

  if (createError || !userData?.user) {
    const yaExiste = createError?.message?.toLowerCase().includes('already registered')
      || createError?.message?.toLowerCase().includes('already been registered')
    return NextResponse.json(
      { error: yaExiste ? 'Este email ya tiene una cuenta en KLIA.' : (createError?.message ?? 'Error al crear el usuario') },
      { status: yaExiste ? 409 : 500 },
    )
  }

  const { error: insertError } = await db.from('vendedores').insert({
    user_id: userData.user.id,
    colegio_id,
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: email.trim(),
  })

  if (insertError) {
    try {
      await db.auth.admin.deleteUser(userData.user.id)
    } catch (rollbackError) {
      console.error('[ops/vendedores] Rollback de auth.users falló — requiere limpieza manual:', rollbackError)
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Mismo mecanismo que /api/auth/recuperar (generateLink type='recovery' +
  // Brevo): el vendedor recién creado no tiene contraseña todavía, así que
  // el link de "recuperar contraseña" es, en los hechos, su link para
  // definirla por primera vez.
  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim(),
    options: {
      redirectTo: `${resolverBaseUrl(req)}/auth/callback?type=recovery`,
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[ops/vendedores] Error generando el link de contraseña:', linkError)
    return NextResponse.json({ ok: true, warning: 'El vendedor se creó pero no se pudo enviar el mail para definir la contraseña.' })
  }

  try {
    await enviarEmail({
      destinatario: email.trim(),
      nombreDestinatario: nombre.trim(),
      asunto: 'Definí tu contraseña en KLIA',
      htmlContent: emailRecuperacionContrasena(nombre.trim(), linkData.properties.action_link),
    })
  } catch (emailError) {
    console.error('[ops/vendedores] Error enviando el mail:', emailError)
    return NextResponse.json({ ok: true, warning: 'El vendedor se creó pero no se pudo enviar el mail para definir la contraseña.' })
  }

  return NextResponse.json({ ok: true })
}
