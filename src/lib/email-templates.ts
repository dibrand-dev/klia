function baseTemplate(contenido: string, titulo?: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo || 'KLIA'}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f9fb;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f7f9fb;">
  <tr><td align="center" style="padding:32px 16px 48px 16px;">

    <!-- Logo above card -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
      <tr><td align="center" style="padding:8px 0 24px 0;">
        <a href="https://app.klia.com.ar" target="_blank" style="text-decoration:none;border:0;">
          <img src="https://app.klia.com.ar/logo-email.png" width="160" height="80" alt="KLIA"
               style="display:block;width:160px;height:auto;max-width:160px;border:0;outline:none;" />
        </a>
      </td></tr>
    </table>

    <!-- Main card -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"
           style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;box-shadow:0 1px 2px rgba(0,26,72,0.04),0 8px 24px rgba(0,26,72,0.06);overflow:hidden;">
      <tr>
        <td height="4" style="height:4px;line-height:4px;font-size:0;background-color:#001a48;background-image:linear-gradient(90deg,#001a48 0%,#002d72 50%,#2563EB 100%);">&nbsp;</td>
      </tr>
      <tr><td style="padding:48px 48px 40px 48px;">${contenido}</td></tr>
    </table>

    <!-- Footer -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
      <tr><td align="center" style="padding:28px 24px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b7180;">
        <a href="https://app.klia.com.ar" target="_blank" style="color:#001a48;text-decoration:none;font-weight:600;">app.klia.com.ar</a>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <a href="mailto:hola@klia.com.ar" style="color:#001a48;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>
      </td></tr>
      <tr><td align="center" style="padding:6px 24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a90a0;">
        © 2026 KLIA Health Tech. Todos los derechos reservados.
      </td></tr>
      <tr><td align="center" style="padding:4px 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a90a0;">
        Recibís este mail porque tenés una cuenta activa en KLIA.
      </td></tr>
    </table>

  </td></tr>
</table>
</body>
</html>`
}

function icon(emoji: string, bgColor: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
  <tr>
    <td align="center" width="72" height="72" style="width:72px;height:72px;background-color:${bgColor};border-radius:36px;text-align:center;vertical-align:middle;font-size:34px;line-height:72px;">
      ${emoji}
    </td>
  </tr>
</table>`
}

function h1(text: string): string {
  return `<h1 style="margin:24px 0 0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;font-weight:700;color:#001a48;letter-spacing:-0.4px;text-align:center;">${text}</h1>`
}

function para(text: string): string {
  return `<p style="margin:20px 0 0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#444651;text-align:center;">${text}</p>`
}

function infoBox(content: string, bg: string, border: string, color: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${bg};border-radius:10px;border-left:3px solid ${border};margin-top:28px;">
  <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${color};">${content}</td></tr>
</table>`
}

function cta(text: string, url: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:32px auto 0;">
  <tr>
    <td align="center" bgcolor="#001a48" style="background-color:#001a48;background-image:linear-gradient(90deg,#001a48 0%,#002d72 100%);border-radius:12px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${text}</a>
    </td>
  </tr>
</table>`
}

function help(text: string): string {
  return `<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#7a7f8a;text-align:center;">${text}</p>`
}

export function emailConfirmacionCuenta(nombre: string, urlConfirmacion: string): string {
  return baseTemplate(`
    ${icon('✉️', '#eff6ff')}
    ${h1('Confirmá tu cuenta')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, gracias por registrarte en KLIA.<br>Para activar tu cuenta hacé clic en el botón de abajo.`)}
    ${cta('Confirmar mi cuenta', urlConfirmacion)}
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;border-top:1px solid #e8eaf0;">
      <tr><td style="padding:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#7a7f8a;text-align:center;">
        Si el botón no funciona, copiá y pegá este enlace:<br>
        <a href="${urlConfirmacion}" style="color:#2563EB;word-break:break-all;font-size:11px;">${urlConfirmacion}</a>
      </td></tr>
    </table>
  `, 'Confirmá tu cuenta — KLIA')
}

export function emailBienvenida(nombre: string, diasPrueba: number): string {
  return baseTemplate(`
    ${icon('🎉', '#f0fdf4')}
    ${h1(`¡Bienvenido a KLIA, ${nombre}!`)}
    ${para(`Tu cuenta está activa. Tenés <strong style="color:#2b2f38;">${diasPrueba} días de prueba gratuita</strong> con acceso completo a todas las funcionalidades.`)}
    ${infoBox(`
      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0f3a27;">¿Qué podés hacer en KLIA?</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1d4a36;">✓ &nbsp;Gestionar tu agenda y turnos online</td></tr>
        <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1d4a36;">✓ &nbsp;Llevar fichas clínicas de cada paciente</td></tr>
        <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1d4a36;">✓ &nbsp;Registrar pagos y liquidaciones de obras sociales</td></tr>
        <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1d4a36;">✓ &nbsp;Generar planillas de asistencia en PDF</td></tr>
        <tr><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1d4a36;">✓ &nbsp;Interconsultas con colegas</td></tr>
      </table>
    `, '#e8f6ee', '#1f8a5b', '#1d4a36')}
    ${cta('Ir a mi consultorio', 'https://app.klia.com.ar/dashboard')}
    ${help('¿Tenés dudas? Escribinos a <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>')}
  `, '¡Bienvenido a KLIA!')
}

export function emailTrialDia7(nombre: string): string {
  return baseTemplate(`
    ${icon('🎉', '#f0fdf4')}
    ${h1('Llevás una semana en KLIA')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, ¿cómo te está yendo con tu consultorio?`)}
    ${para('Ya pasó una semana desde que empezaste tu prueba. Esperamos que KLIA te esté ayudando a ahorrar tiempo.')}
    ${infoBox('💡&nbsp; Todavía te quedan <strong style="color:#0f3a27;">14 días</strong> para explorar todo lo que KLIA tiene para ofrecerte — agenda, cobros, fichas clínicas y más.', '#e8f6ee', '#1f8a5b', '#1d4a36')}
    ${cta('Ver planes y contratar &rarr;', 'https://app.klia.com.ar/planes')}
    ${help('¿Tenés dudas? Escribinos a <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>')}
  `, 'Llevás una semana en KLIA — KLIA')
}

export function emailTrialDia14(nombre: string): string {
  return baseTemplate(`
    ${icon('📅', '#fff4d1')}
    ${h1('Te quedan 7 días de prueba')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, tu período de prueba gratuita vence en 7 días.`)}
    ${para('Hasta ahora pudiste usar todas las funcionalidades del Plan Premium. Para seguir gestionando tu consultorio sin interrupciones, elegí el plan que mejor se adapte a tu práctica.')}
    ${infoBox('💡&nbsp; El <strong style="color:#0f3a27;">Plan Esencial</strong> arranca desde <strong style="color:#0f3a27;">$15.000/mes</strong> — menos de lo que cobrás por una sesión.', '#e8f6ee', '#1f8a5b', '#1d4a36')}
    ${cta('Ver planes y contratar &rarr;', 'https://app.klia.com.ar/planes')}
    ${help('¿Tenés dudas sobre qué plan elegir? Escribinos a <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a> y te ayudamos.')}
  `, 'Te quedan 7 días de prueba — KLIA')
}

export function emailTrialPorVencer(nombre: string, diasRestantes: number): string {
  return baseTemplate(`
    ${icon('⏰', '#fff4d1')}
    ${h1('Te quedan 3 días de prueba')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, tu prueba gratuita de KLIA vence en <strong style="color:#d97706;">${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}</strong>.`)}
    ${infoBox('Para seguir usando KLIA sin interrupciones, elegí un plan antes de que venza el período de prueba. No perderás ningún dato ni configuración.', '#fffbeb', '#d97706', '#92400e')}
    ${cta('Ver planes y contratar &rarr;', 'https://app.klia.com.ar/planes')}
    ${help('¿Preguntas sobre los planes? <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>')}
  `, 'Te quedan 3 días de prueba — KLIA')
}

export function emailTrialDia20(nombre: string): string {
  return baseTemplate(`
    ${icon('⏰', '#fff4d1')}
    ${h1('Mañana vence tu prueba')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, tu período de prueba de KLIA <strong style="color:#dc2626;">vence mañana</strong>.`)}
    ${infoBox('⚠️&nbsp; Si no elegís un plan, perderás el acceso al día siguiente. Tus datos quedan guardados — podés reactivar cuando quieras.', '#fef2f2', '#dc2626', '#991b1b')}
    ${cta('Suscribirme ahora &rarr;', 'https://app.klia.com.ar/planes')}
    ${help('¿Necesitás ayuda para elegir? <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>')}
  `, 'Mañana vence tu prueba — KLIA')
}

export function emailCuentaBloqueada(nombre: string): string {
  return baseTemplate(`
    ${icon('🔒', '#fef2f2')}
    ${h1('Tu cuenta está pausada')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, tu período de prueba gratuita de KLIA venció y tu cuenta fue suspendida temporalmente.`)}
    ${infoBox('Tus datos están seguros. Para reactivar el acceso elegí un plan y tu consultorio quedará disponible de inmediato.', '#fef2f2', '#dc2626', '#991b1b')}
    ${cta('Reactivar mi cuenta', 'https://app.klia.com.ar/planes')}
    ${help('¿Necesitás ayuda? <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>')}
  `, 'Tu cuenta está pausada — KLIA')
}

export function emailPagoExitoso(
  nombre: string,
  plan: string,
  modalidad: string,
  monto: number,
  proximoCobro: string
): string {
  const montoFormateado = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)
  return baseTemplate(`
    ${icon('✅', '#f0fdf4')}
    ${h1('¡Pago confirmado!')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, confirmamos que recibimos tu pago. Tu suscripción a KLIA está activa.`)}
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f7f9fb;border-radius:10px;margin-top:28px;">
      <tr><td style="padding:20px 24px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7a7f8a;border-bottom:1px solid #e0e3e5;">Plan</td>
            <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#001a48;text-align:right;border-bottom:1px solid #e0e3e5;">${plan}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7a7f8a;border-bottom:1px solid #e0e3e5;">Modalidad</td>
            <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#001a48;text-align:right;border-bottom:1px solid #e0e3e5;">${modalidad}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7a7f8a;border-bottom:1px solid #e0e3e5;">Importe</td>
            <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#001a48;text-align:right;border-bottom:1px solid #e0e3e5;">${montoFormateado}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7a7f8a;">Próximo cobro</td>
            <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#001a48;text-align:right;">${proximoCobro}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${cta('Ir a mi consultorio', 'https://app.klia.com.ar/dashboard')}
    ${help('Podés gestionar tu suscripción en <a href="https://app.klia.com.ar/ajustes/suscripcion" style="color:#2563EB;text-decoration:none;font-weight:600;">Ajustes → Suscripción</a>')}
  `, '¡Pago confirmado! — KLIA')
}

export function emailPagoFallido(nombre: string, plan: string): string {
  return baseTemplate(`
    ${icon('⚠️', '#fffbeb')}
    ${h1('No pudimos procesar tu pago')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, no pudimos procesar el pago de tu suscripción al plan <strong style="color:#2b2f38;">${plan}</strong>.`)}
    ${infoBox(`
      <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#92400e;">¿Qué podés hacer?</p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#92400e;">• &nbsp;Verificar que tu tarjeta tenga fondos suficientes</td></tr>
        <tr><td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#92400e;">• &nbsp;Actualizar el método de pago desde tu cuenta de MercadoPago</td></tr>
        <tr><td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#92400e;">• &nbsp;Contactarnos si el problema persiste</td></tr>
      </table>
    `, '#fffbeb', '#d97706', '#92400e')}
    ${cta('Gestionar suscripción', 'https://app.klia.com.ar/ajustes/suscripcion')}
    ${help('¿Necesitás ayuda? <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>')}
  `, 'No pudimos procesar tu pago — KLIA')
}

export function emailSuscripcionCancelada(nombre: string, fechaAcceso: string): string {
  return baseTemplate(`
    ${icon('👋', '#f1f5f9')}
    ${h1('Tu suscripción fue cancelada')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${nombre}</strong>, confirmamos la cancelación de tu suscripción a KLIA.`)}
    ${infoBox(`Vas a poder seguir usando KLIA hasta el <strong style="color:#334155;">${fechaAcceso}</strong>. A partir de esa fecha tu acceso quedará suspendido, pero todos tus datos se conservarán.`, '#f1f5f9', '#94a3b8', '#475569')}
    ${para('Si querés reactivar tu cuenta en el futuro, podés hacerlo desde Ajustes → Suscripción.<br>Lamentamos verte partir — si querés contarnos el motivo, escribinos.')}
    ${help('<a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>')}
  `, 'Tu suscripción fue cancelada — KLIA')
}
