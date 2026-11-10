import { serviceClient } from '@/lib/supabase/service'
import { enviarEmail } from '@/lib/brevo'
import { puedeUsarPortal } from '@/lib/portal/acceso'
import { diasRetencionPorPlan } from '@/lib/portal/retencion'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'
const LOGO_URL = 'https://app.klia.com.ar/logo-email.png'

type ResultadoInvitacion =
  | { ok: true; emailEnviado?: boolean }
  | { ok: false; status: number; error: string; message?: string }

const EMAIL_YA_REGISTRADO = /already registered|already been registered|already exists/i

// Para el console.error de un fallo de envío — nunca el email completo del
// paciente en los logs.
function enmascararEmail(email: string): string {
  const [usuario, dominio] = email.split('@')
  if (!dominio) return '***'
  return `${usuario[0] ?? ''}***@${dominio}`
}

// ── Email provisorio ──────────────────────────────────────────────────────
// Mail de invitación definitivo (diseño "Mail - Invitacion Portal.html"):
// tabla a prueba de clientes de correo (bgcolor + <a> con fondo propio +
// VML para Outlook vía <!--[if mso]-->), preheader oculto, logo con URL
// absoluta pública (igual que el resto de los mails de email-templates.ts).
function emailInvitacionPaciente(nombreProfesional: string, nombrePacientePrimerNombre: string, actionLink: string, diasRetencion: number | null): string {
  const dias = diasRetencion ?? 60
  const nombrePaciente = nombrePacientePrimerNombre || 'paciente'
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${nombreProfesional} te invitó a su portal de pacientes</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block}
a{color:#1F4FD9}
a:hover{color:#16389F}
@media only screen and (max-width:620px){.container{width:100%!important}.px{padding-left:24px!important;padding-right:24px!important}.h1{font-size:22px!important;line-height:28px!important}}
</style>
</head>
<body style="margin:0;padding:0;background-color:#F1F3F6;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F1F3F6;">Activá tu cuenta para ver tu plan y registrar tus comidas.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#F1F3F6" style="background-color:#F1F3F6;">
<tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="560" border="0" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" class="container" width="560" border="0" cellspacing="0" cellpadding="0" style="width:560px;max-width:560px;">
<tr><td style="padding:0 4px 18px 4px;"><img src="${LOGO_URL}" width="92" alt="KLIA" style="width:92px;height:auto;"></td></tr>
<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #E7E9EE;border-radius:12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr><td class="px" style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<p style="margin:0 0 6px 0;font-size:13px;line-height:18px;color:#5B6472;">Nutrición · Portal del paciente</p>
<h1 class="h1" style="margin:0 0 18px 0;font-size:24px;line-height:30px;font-weight:700;color:#0B1220;">${nombreProfesional} te invitó a su portal de pacientes</h1>
<p style="margin:0 0 14px 0;font-size:16px;line-height:24px;color:#1F2937;">Hola, ${nombrePaciente}:</p>
<p style="margin:0 0 28px 0;font-size:16px;line-height:24px;color:#1F2937;">Desde el portal vas a poder ver tu plan alimentario y registrar con una foto lo que comés en cada comida. Activá tu cuenta y creá tu contraseña para empezar.</p>
</td></tr>
<tr><td align="center" class="px" style="padding:0 40px 28px 40px;">
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center">
<tr><td align="center" bgcolor="#0B1220" style="background-color:#0B1220;border-radius:8px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${actionLink}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="16%" stroke="f" fillcolor="#0B1220"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Activar mi cuenta</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${actionLink}" target="_blank" style="display:inline-block;background-color:#0B1220;border:1px solid #0B1220;border-radius:8px;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;mso-hide:all;"><span style="color:#FFFFFF;">Activar mi cuenta</span></a><!--<![endif]-->
</td></tr>
</table>
</td></tr>
<tr><td class="px" style="padding:0 40px 30px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<p style="margin:0 0 6px 0;font-size:13px;line-height:20px;color:#5B6472;">Si el botón no funciona, copiá y pegá este link en tu navegador:</p>
<p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;"><a href="${actionLink}" target="_blank" style="color:#1F4FD9;text-decoration:underline;">${actionLink}</a></p>
</td></tr>
<tr><td class="px" style="padding:0 40px 34px 40px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td bgcolor="#F6F7F9" style="background-color:#F6F7F9;border:1px solid #E7E9EE;border-radius:8px;padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#1F2937;">Tus fotos y comentarios son visibles solo para tu profesional. Se conservan ${dias} días y luego se eliminan.</td></tr></table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#5B6472;">Recibiste este mail porque ${nombreProfesional} te registró como paciente en KLIA. Si no la conocés, podés ignorar este mensaje.</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
}

// A PROPÓSITO no usa baseTemplate/cta de email-templates.ts (ese catálogo es
// el diseño "real" de KLIA) — esto es un placeholder hasta tener el diseño
// del portal del paciente para el caso de "vínculo" (email ya tenía cuenta
// de paciente por otro profesional). Tabla con bgcolor (no solo CSS, varios
// clientes de correo lo ignoran) + link en texto plano debajo como respaldo.
function emailBoton(texto: string, url: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
    <td bgcolor="#001a48" style="background-color:#001a48;border-radius:8px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${texto}</a>
    </td>
  </tr></table>
  <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5B6472;margin-top:16px;">Si el botón no funciona, copiá y pegá este link en tu navegador:<br>${url}</p>`
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

  const [{ data: paciente }, { data: profile }] = await Promise.all([
    db.from('pacientes').select('id, nombre, apellido, email').eq('id', pacienteId).eq('terapeuta_id', terapeutaId).maybeSingle(),
    db.from('profiles').select('plan').eq('id', terapeutaId).maybeSingle(),
  ])

  if (!paciente) return { ok: false, status: 404, error: 'paciente_no_encontrado' }
  if (!paciente.email) {
    return { ok: false, status: 400, error: 'sin_email', message: 'El paciente no tiene un email cargado.' }
  }

  const habilitado = await puedeUsarPortal(db, terapeutaId)
  if (!habilitado) {
    return { ok: false, status: 403, error: 'portal_no_habilitado', message: 'Tu plan no incluye el portal del paciente.' }
  }

  const diasRetencion = await diasRetencionPorPlan(db, profile?.plan ?? null)

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
      // Nunca el link de activación ni el HTML del mail en el log — solo el
      // destinatario enmascarado y el mensaje de error de Brevo.
      console.error('[portal/invitacion] Error enviando email de vínculo:', enmascararEmail(email), (emailError as Error)?.message)
      return { ok: true, emailEnviado: false }
    }

    return { ok: true, emailEnviado: true }
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
      asunto: `${nombreProfesional} te invitó a su portal de pacientes`,
      htmlContent: emailInvitacionPaciente(nombreProfesional, paciente.nombre, linkData.properties.action_link, diasRetencion),
    })
  } catch (emailError) {
    // Nunca el link de activación ni el HTML del mail en el log — solo el
    // destinatario enmascarado y el mensaje de error de Brevo.
    console.error('[portal/invitacion] Error enviando email:', enmascararEmail(email), (emailError as Error)?.message)
    return { ok: true, emailEnviado: false }
  }

  return { ok: true, emailEnviado: true }
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
