import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { preApproval } from '@/lib/mercadopago'
import type { Database } from '@/types/database'
import { enviarEmail } from '@/lib/brevo'
import { emailCuentaEliminada } from '@/lib/email-templates'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { confirmacion?: string }
  const confirmacion = (body.confirmacion ?? '').trim().toLowerCase()
  if (confirmacion !== user.email.toLowerCase()) {
    return NextResponse.json({ error: 'El email no coincide' }, { status: 400 })
  }

  const db = serviceClient()

  // a) Si hay una suscripción de MP activa, cancelarla — misma lógica que
  // /api/suscripcion/cancelar. Best-effort: si falla, se sigue de todas
  // formas con la baja (no se puede dejar al profesional sin poder darse de
  // baja porque Mercado Pago no responde).
  try {
    const { data: sub } = await db
      .from('suscripciones')
      .select('id, mp_preapproval_id')
      .eq('terapeuta_id', user.id)
      .eq('estado', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sub?.mp_preapproval_id) {
      await preApproval.update({ id: sub.mp_preapproval_id, body: { status: 'cancelled' } })
      await db.from('suscripciones').update({ estado: 'cancelled', updated_at: new Date().toISOString() }).eq('id', sub.id)
    }
  } catch (err) {
    console.error('[cuenta/eliminar] No se pudo cancelar la suscripción de MP:', err)
  }

  // b) Borrar credenciales: Google Calendar y la conexión OAuth de MP del
  // profesional (misma limpieza que /api/google-calendar/disconnect y
  // /api/auth/mercadopago/disconnect). Son tokens — no se conservan nunca.
  try {
    await db.from('google_calendar_tokens').delete().eq('terapeuta_id', user.id)
  } catch (err) {
    console.error('[cuenta/eliminar] No se pudieron borrar los tokens de Google Calendar:', err)
  }

  try {
    await db.from('profiles').update({
      mp_access_token: null,
      mp_refresh_token: null,
      mp_user_id: null,
      mp_email: null,
      mp_nombre: null,
      mp_token_expiry: null,
    } as never).eq('id', user.id)
  } catch (err) {
    console.error('[cuenta/eliminar] No se pudo desconectar Mercado Pago:', err)
  }

  // c) Baja lógica del profile — desactiva también el link público de
  // reservas (booking_activo, misma columna que lee /p/[slug]/page.tsx).
  const ahora = new Date()
  const enDosAnios = new Date(ahora)
  enDosAnios.setFullYear(enDosAnios.getFullYear() + 2)

  try {
    await db.from('profiles').update({
      estado_cuenta: 'eliminada',
      baja_solicitada_en: ahora.toISOString(),
      eliminacion_programada_en: enDosAnios.toISOString(),
      booking_activo: false,
    } as never).eq('id', user.id)
  } catch (err) {
    console.error('[cuenta/eliminar] No se pudo marcar el profile como eliminado:', err)
  }

  // d) Bloquear el acceso: ban en auth.users + cerrar la sesión actual.
  try {
    await db.auth.admin.updateUserById(user.id, { ban_duration: '876000h' })
  } catch (err) {
    console.error('[cuenta/eliminar] No se pudo banear al usuario:', err)
  }

  try {
    await supabase.auth.signOut({ scope: 'global' })
  } catch (err) {
    console.error('[cuenta/eliminar] No se pudo cerrar la sesión:', err)
  }

  // e) Email de confirmación — fire-and-forget, nunca bloquea la respuesta.
  try {
    const { data: profile } = await db.from('profiles').select('nombre, email').eq('id', user.id).single()
    if (profile?.email) {
      enviarEmail({
        destinatario: profile.email,
        nombreDestinatario: profile.nombre ?? profile.email,
        asunto: 'Tu cuenta de KLIA fue dada de baja',
        htmlContent: emailCuentaEliminada(profile.nombre ?? profile.email),
      }).catch(() => {})
    }
  } catch (err) {
    console.error('[cuenta/eliminar] No se pudo enviar el email de confirmación:', err)
  }

  return NextResponse.json({ ok: true })
}
