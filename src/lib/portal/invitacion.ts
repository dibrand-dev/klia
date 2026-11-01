import { serviceClient } from '@/lib/supabase/service'
import { enviarEmail } from '@/lib/brevo'
import { puedeUsarPortal } from '@/lib/portal/acceso'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

type ResultadoInvitacion =
  | { ok: true }
  | { ok: false; status: number; error: string; message?: string }

const EMAIL_YA_REGISTRADO = /already registered|already been registered|already exists/i

// ── Email provisorio ──────────────────────────────────────────────────────
// A PROPÓSITO no usa baseTemplate/cta de email-templates.ts (ese catálogo es
// el diseño "real" de KLIA) — esto es un placeholder hasta tener el diseño
// del portal del paciente. Tabla con bgcolor (no solo CSS, varios clientes
// de correo lo ignoran) + link en texto plano debajo como respaldo.
function emailBoton(texto: string, url: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
    <td bgcolor="#001a48" style="background-color:#001a48;border-radius:8px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${texto}</a>
    </td>
  </tr></table>
  <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6472;margin-top:16px;">Si el botón no funciona, copiá y pegá este link en tu navegador:<br>${url}</p>`
}

function emailInvitacionPacienteProvisorio(nombreProfesional: string, nombrePaciente: string, urlInvitacion: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0B1220;max-width:480px;">
    <p>Hola ${nombrePaciente || ''},</p>
    <p>${nombreProfesional} te invitó a usar el portal de pacientes de KLIA. Desde ahí vas a poder acceder a tu información.</p>
    <p>Para activar tu cuenta, elegí una contraseña:</p>
    ${emailBoton('Activar mi cuenta', urlInvitacion)}
  </div>`
}

function emailVinculoPortalProvisorio(nombreProfesional: string, nombrePaciente: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0B1220;max-width:480px;">
    <p>Hola ${nombrePaciente || ''},</p>
    <p>${nombreProfesional} también te agregó en KLIA. Ya tenés una cuenta del portal de pacientes creada con este mismo email — iniciá sesión con tu contraseña habitual para verlo.</p>
    ${emailBoton('Ir al portal', `${appUrl}/portal/login`)}
  </div>`
}

// Pone app_metadata.tipo_cuenta='paciente' en el usuario de Auth. A
// diferencia de user_metadata (que el propio usuario puede editar desde el
// cliente con auth.updateUser), app_metadata solo lo escribe el server con
// service_role — es la señal que getEffectiveTerapeutaIdServer usa de
// verdad para negar acceso de profesional a una cuenta de portal.
async function marcarAppMetadataPaciente(db: ReturnType<typeof serviceClient>, authUserId: string) {
  const { error } = await db.auth.admin.updateUserById(authUserId, {
    app_metadata: { tipo_cuenta: 'paciente' },
  })
  if (error) console.error('[portal/invitacion] Error seteando app_metadata:', error)
  return !error
}

// Copia el patrón de crearInvitacionColaborador (src/lib/colaboradores/invitacion.ts):
// generateLink + vínculo en nuestra tabla propia + email vía Brevo. terapeutaId
// ya tiene que venir resuelto (getEffectiveTerapeutaIdServer, colaboradora
// incluida) — igual se vuelve a validar ownership acá contra `pacientes`
// como defensa en profundidad.
export async function crearInvitacionPaciente(params: {
  pacienteId: string
  terapeutaId: string
  nombreProfesional: string
}): Promise<ResultadoInvitacion> {
  const { pacienteId, terapeutaId, nombreProfesional } = params
  const db = serviceClient()

  const { data: paciente } = await db
    .from('pacientes')
    .select('id, nombre, apellido, email')
    .eq('id', pacienteId)
    .eq('terapeuta_id', terapeutaId)
    .maybeSingle()

  if (!paciente) return { ok: false, status: 404, error: 'paciente_no_encontrado' }
  if (!paciente.email) {
    return { ok: false, status: 400, error: 'sin_email', message: 'El paciente no tiene un email cargado.' }
  }

  const habilitado = await puedeUsarPortal(db, terapeutaId)
  if (!habilitado) {
    return { ok: false, status: 403, error: 'portal_no_habilitado', message: 'Tu plan no incluye el portal del paciente.' }
  }

  const email = paciente.email
  const nombrePaciente = `${paciente.nombre} ${paciente.apellido}`.trim()

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { tipo_cuenta: 'paciente' },
      redirectTo: `${appUrl}/portal/activar`,
    },
  })

  if (linkError) {
    if (!EMAIL_YA_REGISTRADO.test(linkError.message)) {
      console.error('[portal/invitacion] Error generando link:', linkError)
      return { ok: false, status: 500, error: 'Error al generar la invitación' }
    }

    // El email ya existe en Auth. Nunca confiamos en metadata para decidir
    // de qué tipo es esa cuenta — lo resolvemos contra nuestras propias
    // tablas (profiles = profesional o colaboradora; paciente_accesos =
    // paciente ya existente invitado por otro profesional).
    const { data: profileExistente } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
    if (profileExistente) {
      return {
        ok: false, status: 409, error: 'email_profesional',
        message: 'Ese email ya tiene una cuenta de profesional o colaboradora en KLIA — no se puede usar para el portal del paciente.',
      }
    }

    const { data: accesoExistente } = await db
      .from('paciente_accesos')
      .select('auth_user_id')
      .eq('email', email)
      .not('auth_user_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (!accesoExistente?.auth_user_id) {
      return {
        ok: false, status: 409, error: 'email_en_uso',
        message: 'Ese email ya tiene una cuenta en KLIA que no pudimos identificar. Contactá a soporte.',
      }
    }

    await marcarAppMetadataPaciente(db, accesoExistente.auth_user_id)

    const { error: upsertError } = await db.from('paciente_accesos').upsert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      auth_user_id: accesoExistente.auth_user_id,
      email,
      estado: 'invitado',
    }, { onConflict: 'paciente_id' })

    if (upsertError) {
      console.error('[portal/invitacion] Error vinculando acceso existente:', upsertError)
      return { ok: false, status: 500, error: 'Error al vincular la cuenta' }
    }

    try {
      await enviarEmail({
        destinatario: email,
        nombreDestinatario: nombrePaciente || email,
        asunto: `${nombreProfesional} te agregó en KLIA`,
        htmlContent: emailVinculoPortalProvisorio(nombreProfesional, nombrePaciente),
      })
    } catch (emailError) {
      console.error('[portal/invitacion] Error enviando email de vínculo:', emailError)
    }

    return { ok: true }
  }

  // Caso nuevo: generateLink creó un usuario de Auth fresco.
  const metadataOk = await marcarAppMetadataPaciente(db, linkData.user.id)
  if (!metadataOk) {
    try { await db.auth.admin.deleteUser(linkData.user.id) } catch (rollbackError) {
      console.error('[portal/invitacion] Rollback de auth.users falló tras error de app_metadata:', rollbackError)
    }
    return { ok: false, status: 500, error: 'Error al configurar la cuenta del paciente' }
  }

  const { error: upsertError } = await db.from('paciente_accesos').upsert({
    paciente_id: pacienteId,
    terapeuta_id: terapeutaId,
    auth_user_id: linkData.user.id,
    email,
    estado: 'invitado',
  }, { onConflict: 'paciente_id' })

  if (upsertError) {
    console.error('[portal/invitacion] Error insertando paciente_accesos:', upsertError)
    try { await db.auth.admin.deleteUser(linkData.user.id) } catch (rollbackError) {
      console.error('[portal/invitacion] Rollback de auth.users también falló:', rollbackError)
    }
    return { ok: false, status: 500, error: 'Error al vincular la invitación' }
  }

  try {
    await enviarEmail({
      destinatario: email,
      nombreDestinatario: nombrePaciente || email,
      asunto: `${nombreProfesional} te invitó a KLIA`,
      htmlContent: emailInvitacionPacienteProvisorio(nombreProfesional, nombrePaciente, linkData.properties.action_link),
    })
  } catch (emailError) {
    console.error('[portal/invitacion] Error enviando email:', emailError)
  }

  return { ok: true }
}

// Reenviar: si hay un usuario de Auth huérfano (invitado, nunca activado, y
// ningún OTRO paciente_accesos lo referencia — puede ser la misma persona
// invitada por dos profesionales distintos) se borra, y se corre de nuevo
// crearInvitacionPaciente, que hace upsert sobre la misma fila (paciente_id
// es único) — resetea estado a 'invitado' y auth_user_id con el flujo normal.
export async function reenviarInvitacionPaciente(params: {
  pacienteId: string
  terapeutaId: string
  nombreProfesional: string
}): Promise<ResultadoInvitacion> {
  const { pacienteId, terapeutaId, nombreProfesional } = params
  const db = serviceClient()

  const { data: acceso } = await db
    .from('paciente_accesos')
    .select('paciente_id, auth_user_id, estado')
    .eq('paciente_id', pacienteId)
    .eq('terapeuta_id', terapeutaId)
    .maybeSingle()

  if (!acceso) return { ok: false, status: 404, error: 'sin_invitacion', message: 'No hay una invitación para este paciente.' }
  if (acceso.estado === 'activo') {
    return { ok: false, status: 400, error: 'ya_activo', message: 'El paciente ya activó su cuenta, no se puede reenviar.' }
  }

  if (acceso.auth_user_id) {
    const { count } = await db
      .from('paciente_accesos')
      .select('paciente_id', { count: 'exact', head: true })
      .eq('auth_user_id', acceso.auth_user_id)
      .neq('paciente_id', pacienteId)

    if (!count) {
      try { await db.auth.admin.deleteUser(acceso.auth_user_id) } catch (deleteError) {
        console.error('[portal/invitacion] Error eliminando usuario huérfano:', deleteError)
      }
    }
  }

  return crearInvitacionPaciente({ pacienteId, terapeutaId, nombreProfesional })
}

export async function revocarAccesoPaciente(pacienteId: string, terapeutaId: string): Promise<ResultadoInvitacion> {
  const db = serviceClient()

  const { data, error } = await db
    .from('paciente_accesos')
    .update({ estado: 'revocado' })
    .eq('paciente_id', pacienteId)
    .eq('terapeuta_id', terapeutaId)
    .select('paciente_id')

  if (error) {
    console.error('[portal/invitacion] Error revocando acceso:', error)
    return { ok: false, status: 500, error: 'Error al revocar el acceso' }
  }
  if (!data || data.length === 0) {
    return { ok: false, status: 404, error: 'sin_acceso', message: 'No hay un acceso de portal para este paciente.' }
  }

  return { ok: true }
}
