import { createClient as createServiceClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailInvitacionColaboradora } from '@/lib/email-templates'
import type { Database } from '@/types/database'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

type ResultadoInvitacion =
  | { ok: true }
  | { ok: false; status: number; error: string; message?: string }

// Extraído de /api/colaboradores/invitar — mismo mecanismo (generateLink +
// insert en `colaboradores` + email vía Brevo), reusado también por
// /api/colaboradores/[id]/reenviar para no duplicar esta lógica en dos lugares.
export async function crearInvitacionColaborador(params: {
  profesionalId: string
  nombreProfesional: string
  email: string
  nombre?: string
}): Promise<ResultadoInvitacion> {
  const { profesionalId, nombreProfesional, email, nombre } = params

  const db = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { tipo_cuenta: 'colaborador', ...(nombre ? { nombre } : {}) },
      redirectTo: `${appUrl}/colaboradora/activar`,
    },
  })

  if (linkError) {
    const yaExiste = linkError.message.toLowerCase().includes('already registered')
      || linkError.message.toLowerCase().includes('already been registered')
      || linkError.message.toLowerCase().includes('already exists')
    if (yaExiste) {
      return {
        ok: false, status: 409, error: 'ya_tiene_cuenta',
        message: 'Este email ya tiene una cuenta en KLIA. Contactá a soporte para vincularlo.',
      }
    }
    return { ok: false, status: 500, error: 'Error al generar la invitación' }
  }

  const { error: insertError } = await db.from('colaboradores').insert({
    profesional_id: profesionalId,
    colaborador_id: linkData.user.id,
    invitacion_aceptada: false,
  })

  if (insertError) {
    console.error('[colaboradores/invitacion] Error insertando colaborador:', insertError)
    if (insertError.code === '23505') {
      return {
        ok: false, status: 409, error: 'invitacion_duplicada',
        message: 'Ya invitaste a este email anteriormente.',
      }
    }
    try {
      await db.auth.admin.deleteUser(linkData.user.id)
    } catch (rollbackError) {
      console.error('[colaboradores/invitacion] Rollback de auth.users también falló — requiere limpieza manual:', rollbackError)
    }
    return {
      ok: false, status: 500, error: 'error_vinculo',
      message: `La invitación se generó pero no pudimos vincularla a tu cuenta. Contactá a soporte con este email: ${email}`,
    }
  }

  try {
    await enviarEmail({
      destinatario: email,
      nombreDestinatario: nombre ?? email,
      asunto: `${nombreProfesional} te invitó a colaborar en KLIA`,
      htmlContent: emailInvitacionColaboradora(nombreProfesional, nombre ?? null, linkData.properties.action_link),
    })
  } catch (emailError) {
    console.error('[colaboradores/invitacion] Error enviando email:', emailError)
  }

  return { ok: true }
}
