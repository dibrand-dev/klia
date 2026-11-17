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

// Reenvío del mail para definir contraseña (el link de recovery vence).
// Exclusivo de Super Admin ('total'), igual que alta/edición.
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUserTotal()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = serviceClient()
  const { data: vendedor } = await db
    .from('vendedores')
    .select('id, nombre, email, activo')
    .eq('id', params.id)
    .single()

  if (!vendedor) return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 })
  if (!vendedor.activo) {
    return NextResponse.json({ error: 'El vendedor está suspendido. Reactivalo antes de reenviar la invitación.' }, { status: 409 })
  }

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'recovery',
    email: vendedor.email,
    options: { redirectTo: `${resolverBaseUrl(req)}/auth/callback?type=recovery` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[ops/vendedores/reenviar] Error generando el link:', linkError)
    return NextResponse.json({ error: 'No se pudo generar el link de contraseña.' }, { status: 502 })
  }

  try {
    await enviarEmail({
      destinatario: vendedor.email,
      nombreDestinatario: vendedor.nombre,
      asunto: 'Definí tu contraseña en KLIA',
      htmlContent: emailRecuperacionContrasena(vendedor.nombre, linkData.properties.action_link),
    })
  } catch (emailError) {
    console.error('[ops/vendedores/reenviar] Error enviando el mail:', emailError)
    return NextResponse.json({ error: 'No se pudo enviar el mail.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
