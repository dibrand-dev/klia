function baseTemplate(contenido: string, titulo?: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo || 'KLIA'}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
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

export function emailResumenCobros(params: {
  pacienteNombre: string
  profesionalNombre: string
  profesionalEspecialidad: string | null
  profesionalEmail: string
  mes: string
  sesiones: Array<{ fecha: string; duracion_min: number; monto: number | null; moneda: string; estado_pago: string }>
  totalMes: number
  yaAbonado: number
  saldoPendiente: number
  moneda: string
}): string {
  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
  const sym = params.moneda === 'USD' ? 'US$' : params.moneda === 'EUR' ? '€' : '$'
  const fmtAmt = (n: number) => `<span style="font-size:11px;color:#8A93A1;font-weight:500;margin-right:2px;">${sym}</span>${fmt(n)}&nbsp;${params.moneda}`

  const sesionesRows = params.sesiones.map(s => {
    const isBonif = s.estado_pago === 'bonificado'
    const sSym = s.moneda === 'USD' ? 'US$' : s.moneda === 'EUR' ? '€' : '$'
    const montoCell = s.monto != null
      ? `<span style="${isBonif ? 'color:#AEB5C0;text-decoration:line-through;' : ''}">${sSym}&nbsp;${fmt(s.monto)}&nbsp;${s.moneda}</span>${isBonif ? '&nbsp;<span style="display:inline-block;padding:1px 6px;border-radius:100px;background:#F3F4F6;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Bonificada</span>' : ''}`
      : '—'
    return `<tr>
      <td style="padding:11px 4px;border-bottom:1px solid #F1F3F6;font-family:'Courier New',Courier,monospace;font-size:12.5px;color:#1F2937;">${s.fecha}</td>
      <td style="padding:11px 4px;border-bottom:1px solid #F1F3F6;font-size:14px;color:#5B6472;">${s.duracion_min}&nbsp;min</td>
      <td style="padding:11px 4px;border-bottom:1px solid #F1F3F6;text-align:right;font-size:14px;font-weight:600;color:#1F2937;">${montoCell}</td>
    </tr>`
  }).join('')

  const contenido = `
    <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:#0B1220;">Estimado/a ${params.pacienteNombre.split(' ')[0]},</p>
    <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:#1F2937;">
      A continuación encontrará el detalle de sus sesiones del mes de <strong style="font-weight:600;color:#0B1220;">${params.mes}</strong>.
    </p>

    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#5B6472;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid #E7E9EE;">Detalle de sesiones</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <thead>
        <tr>
          <th style="font-size:10.5px;font-weight:700;color:#8A93A1;text-transform:uppercase;letter-spacing:0.08em;text-align:left;padding:8px 4px;border-bottom:1px solid #E7E9EE;font-family:Arial,Helvetica,sans-serif;">Fecha</th>
          <th style="font-size:10.5px;font-weight:700;color:#8A93A1;text-transform:uppercase;letter-spacing:0.08em;text-align:left;padding:8px 4px;border-bottom:1px solid #E7E9EE;font-family:Arial,Helvetica,sans-serif;">Duración</th>
          <th style="font-size:10.5px;font-weight:700;color:#8A93A1;text-transform:uppercase;letter-spacing:0.08em;text-align:right;padding:8px 4px;border-bottom:1px solid #E7E9EE;font-family:Arial,Helvetica,sans-serif;">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${sesionesRows || '<tr><td colspan="3" style="padding:16px 4px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8A93A1;">Sin sesiones</td></tr>'}
      </tbody>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F6F7F9;border:1px solid #E7E9EE;border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1F2937;">Total del mes</td>
            <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#1F2937;text-align:right;">${fmtAmt(params.totalMes)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1F2937;">Ya abonado</td>
            <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#10b981;text-align:right;">${fmtAmt(params.yaAbonado)}</td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#0B1220;border-top:1px dashed #E7E9EE;margin-top:4px;">Saldo pendiente</td>
            <td style="padding:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:${params.saldoPendiente > 0 ? '#DC2626' : '#0B1220'};text-align:right;border-top:1px dashed #E7E9EE;">${fmtAmt(params.saldoPendiente)}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    ${cta('Ver detalle online', 'https://app.klia.com.ar/cobros')}

    <p style="margin:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1F2937;">
      Ante cualquier consulta no dude en comunicarse.
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:28px;padding-top:20px;border-top:1px solid #E7E9EE;">
      <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#374151;">
        <strong style="font-size:15px;font-weight:700;color:#0B1220;">${params.profesionalNombre}</strong><br>
        ${params.profesionalEspecialidad ? `<span style="font-size:13px;color:#5B6472;">${params.profesionalEspecialidad}</span><br>` : ''}
        <a href="mailto:${params.profesionalEmail}" style="font-size:12.5px;color:#2563EB;text-decoration:none;">${params.profesionalEmail}</a>
      </td></tr>
    </table>
  `
  return baseTemplate(contenido, `Resumen de sesiones — ${params.mes}`)
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

// ── Payment flow templates ────────────────────────────────────────────

function sessionDetailBox(params: {
  fecha: string; hora: string; duracion: number; modalidad: string; monto: number; moneda: string
}): string {
  const modalidadLabel: Record<string, string> = {
    presencial: 'Presencial', videollamada: 'Videollamada', telefonica: 'Telefónica',
  }
  const montoFmt = params.monto.toLocaleString('es-AR')
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
    style="background-color:#F6F7F9;border-radius:12px;border:1px solid #E7E9EE;margin-top:24px;">
    <tr><td style="padding:18px 20px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#8A93A1;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:14px;">Detalle de tu sesión</td>
        </tr>
        <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:#1F2937;padding:5px 0;border-bottom:1px solid #E7E9EE;">
          📅 <strong>Fecha:</strong> ${params.fecha}
        </td></tr>
        <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:#1F2937;padding:5px 0;border-bottom:1px solid #E7E9EE;">
          🕐 <strong>Horario:</strong> ${params.hora} hs · ${params.duracion} min
        </td></tr>
        <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:#1F2937;padding:5px 0;border-bottom:1px solid #E7E9EE;">
          📍 <strong>Modalidad:</strong> ${modalidadLabel[params.modalidad] ?? params.modalidad}
        </td></tr>
        <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0B1220;padding:10px 0 4px;">
          💰 Total: $${montoFmt} ${params.moneda}
        </td></tr>
      </table>
    </td></tr>
  </table>`
}

function ctaMP(text: string, url: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 0;">
  <tr>
    <td align="center" bgcolor="#009EE3" style="background-color:#009EE3;border-radius:12px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${text}</a>
    </td>
  </tr>
</table>`
}

export function emailPagoSesionPendiente(params: {
  pacienteNombre: string
  profesionalNombre: string
  profesionalEspecialidad: string
  fecha: string
  hora: string
  duracion: number
  modalidad: string
  monto: number
  moneda: string
  hash: string
  venceAt: string
  mensajePersonalizado: string
}): string {
  const appUrl = 'https://app.klia.com.ar'
  const payUrl = `${appUrl}/pagar/${params.hash}`
  const venceFmt = new Date(params.venceAt).toLocaleString('es-AR', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
  return baseTemplate(`
    ${icon('🗓️', '#EFF4FF')}
    ${h1('Completá el pago para confirmar tu sesión')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${params.pacienteNombre}</strong>, ${params.profesionalNombre}${params.profesionalEspecialidad ? ` (${params.profesionalEspecialidad})` : ''} agendó una sesión para vos.`)}
    ${sessionDetailBox(params)}
    ${ctaMP('Pagar sesión', payUrl)}
    ${infoBox(`⏳ Tenés hasta el <strong style="color:#334155;">${venceFmt}</strong> para completar el pago y confirmar tu lugar.${params.mensajePersonalizado ? `<br><br>💬 Mensaje de tu profesional: <em>${params.mensajePersonalizado}</em>` : ''}`, '#FFF7ED', '#F59E0B', '#92400E')}
    ${help(`Dudas: <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>`)}
  `, 'Confirmá tu sesión — KLIA')
}

export function emailPagoSesionConfirmada(params: {
  pacienteNombre: string
  profesionalNombre: string
  fecha: string
  hora: string
  duracion: number
  modalidad: string
  monto: number
  moneda: string
}): string {
  const montoFmt = params.monto.toLocaleString('es-AR')
  return baseTemplate(`
    ${icon('✅', '#DCFCE7')}
    ${h1('¡Sesión confirmada!')}
    ${para(`Tu pago fue procesado correctamente. Tu sesión con <strong style="color:#2b2f38;font-weight:600;">${params.profesionalNombre}</strong> está confirmada.`)}
    ${sessionDetailBox(params)}
    ${infoBox(`✅ Pago de <strong style="color:#334155;">$${montoFmt} ${params.moneda}</strong> recibido correctamente.${params.modalidad === 'videollamada' ? '<br><br>📹 Tu profesional te enviará el link de videollamada antes de la sesión.' : ''}`, '#F0FDF4', '#22C55E', '#166534')}
    ${help(`Dudas: <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>`)}
  `, 'Sesión confirmada — KLIA')
}

export function emailPagoSesionRechazada(params: {
  destinatario: 'paciente' | 'profesional'
  pacienteNombre: string
  profesionalNombre: string
  fecha: string
  hora: string
}): string {
  const esPaciente = params.destinatario === 'paciente'
  return baseTemplate(`
    ${icon('❌', '#FEE2E2')}
    ${h1(esPaciente ? 'No pudimos procesar tu pago' : 'Sesión no confirmada por falta de pago')}
    ${esPaciente
      ? para(`Hola <strong style="color:#2b2f38;font-weight:600;">${params.pacienteNombre}</strong>, luego de varios intentos no pudimos procesar tu pago. Tu sesión del ${params.fecha} a las ${params.hora} hs fue <strong style="color:#dc2626;">cancelada</strong>.`)
      : para(`La sesión del <strong style="color:#2b2f38;font-weight:600;">${params.fecha} a las ${params.hora} hs</strong> con <strong style="color:#2b2f38;font-weight:600;">${params.pacienteNombre}</strong> fue cancelada por falta de pago luego de 3 intentos fallidos.`)
    }
    ${infoBox(
      esPaciente
        ? 'Si querés agendar una nueva sesión, contactá directamente a tu profesional.'
        : `El turno fue liberado en tu agenda. Podés contactar al paciente si lo considerás necesario.`,
      '#FEF2F2', '#EF4444', '#991B1B'
    )}
    ${help(`Dudas: <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>`)}
  `, 'Sesión cancelada — KLIA')
}

export function emailPagoSesionVencida(params: {
  pacienteNombre: string
  profesionalNombre: string
  fecha: string
}): string {
  return baseTemplate(`
    ${icon('⏰', '#FEF3C7')}
    ${h1('Tu reserva venció')}
    ${para(`Hola <strong style="color:#2b2f38;font-weight:600;">${params.pacienteNombre}</strong>, el tiempo para completar el pago de tu sesión del ${params.fecha} con <strong style="color:#2b2f38;font-weight:600;">${params.profesionalNombre}</strong> expiró.`)}
    ${infoBox('Tu lugar fue liberado. Si querés agendar una nueva sesión, contactá directamente a tu profesional.', '#FFFBEB', '#F59E0B', '#92400E')}
    ${help(`Dudas: <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;font-weight:600;">hola@klia.com.ar</a>`)}
  `, 'Tu reserva venció — KLIA')
}
