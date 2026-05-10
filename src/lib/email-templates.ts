function baseTemplate(contenido: string, titulo?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo || 'KLIA'}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f9fb;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- LOGO HEADER — fondo blanco -->
      <tr><td style="text-align:center;padding:32px 0 24px;background-color:#ffffff;border-radius:16px 16px 0 0;">
        <img src="https://app.klia.com.ar/logo-email.png" alt="KLIA" width="180" height="90" style="display:block;margin:0 auto;border:0;" />
      </td></tr>

      <!-- MAIN CARD — continua del header blanco -->
      <tr><td style="background-color:#ffffff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,26,72,0.06);">

        <!-- Accent top bar -->
        <div style="height:4px;background:linear-gradient(135deg,#001a48,#002d72);"></div>

        <!-- Card content -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:48px 48px 40px;">
            ${contenido}
          </td></tr>
        </table>

      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:32px 16px;text-align:center;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#001a48;">KLIA</p>
        <p style="margin:0 0 12px;font-size:12px;color:#747782;">
          <a href="https://app.klia.com.ar" style="color:#001a48;text-decoration:none;">app.klia.com.ar</a>
          &nbsp;•&nbsp;
          <a href="mailto:hola@klia.com.ar" style="color:#001a48;text-decoration:none;">hola@klia.com.ar</a>
        </p>
        <p style="margin:0 0 12px;font-size:12px;color:#747782;">
          <a href="#" style="color:#747782;text-decoration:none;">Términos y Condiciones</a>
          &nbsp;•&nbsp;
          <a href="#" style="color:#747782;text-decoration:none;">Privacidad</a>
        </p>
        <p style="margin:0;font-size:11px;color:#747782;text-transform:uppercase;letter-spacing:0.05em;">
          © 2026 KLIA Health Tech. Todos los derechos reservados.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

export function emailConfirmacionCuenta(nombre: string, urlConfirmacion: string): string {
  return baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background-color:#eff6ff;border-radius:50%;line-height:56px;font-size:28px;">✉️</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#001a48;text-align:center;letter-spacing:-0.02em;">
      Confirmá tu cuenta
    </h1>
    <p style="margin:0 0 32px;font-size:14px;color:#444651;line-height:1.6;text-align:center;">
      Hola <strong>${nombre}</strong>, gracias por registrarte en KLIA.<br>
      Para activar tu cuenta hacé clic en el botón de abajo.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${urlConfirmacion}" style="display:inline-block;background:linear-gradient(135deg,#001a48,#002d72);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">
        Confirmar mi cuenta
      </a>
    </div>
    <hr style="border:none;border-top:1px solid #e0e3e5;margin:32px 0;" />
    <p style="margin:0 0 8px;font-size:12px;color:#747782;text-align:center;">
      Si el botón no funciona, copiá y pegá este enlace:
    </p>
    <p style="margin:0;font-size:12px;text-align:center;">
      <a href="${urlConfirmacion}" style="color:#001a48;word-break:break-all;">${urlConfirmacion}</a>
    </p>
  `, 'Confirmá tu cuenta — KLIA')
}

export function emailBienvenida(nombre: string, diasPrueba: number): string {
  return baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background-color:#f0fdf4;border-radius:50%;line-height:56px;font-size:28px;">🎉</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#001a48;text-align:center;letter-spacing:-0.02em;">
      ¡Bienvenido/a a KLIA!
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#444651;line-height:1.6;text-align:center;">
      Hola <strong>${nombre}</strong>, tu cuenta está activa.<br>
      Tenés <strong>${diasPrueba} días de prueba gratuita</strong> con acceso completo a todas las funcionalidades.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;border-radius:12px;margin-bottom:32px;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#001a48;text-transform:uppercase;letter-spacing:0.05em;">¿Qué podés hacer en KLIA?</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;font-size:14px;color:#444651;">✓ &nbsp;Gestionar tu agenda y turnos online</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#444651;">✓ &nbsp;Llevar fichas clínicas de cada paciente</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#444651;">✓ &nbsp;Registrar pagos y generar liquidaciones de obras sociales</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#444651;">✓ &nbsp;Generar planillas de asistencia en PDF</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#444651;">✓ &nbsp;Interconsultas con colegas</td></tr>
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://app.klia.com.ar/dashboard" style="display:inline-block;background:linear-gradient(135deg,#001a48,#002d72);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">
        Ir a mi consultorio
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#747782;text-align:center;">
      ¿Tenés dudas? Escribinos a <a href="mailto:hola@klia.com.ar" style="color:#001a48;">hola@klia.com.ar</a>
    </p>
  `, '¡Bienvenido/a a KLIA!')
}

export function emailTrialPorVencer(nombre: string, diasRestantes: number): string {
  return baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background-color:#fffbeb;border-radius:50%;line-height:56px;font-size:28px;">⏰</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#001a48;text-align:center;letter-spacing:-0.02em;">
      Tu período de prueba está por vencer
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#444651;line-height:1.6;text-align:center;">
      Hola <strong>${nombre}</strong>, tu prueba gratuita de KLIA vence en<br>
      <strong style="font-size:20px;color:#d97706;">${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:12px;margin-bottom:32px;">
      <tr><td style="padding:20px 24px;font-size:14px;color:#92400e;line-height:1.6;">
        Para seguir usando KLIA sin interrupciones, elegí un plan antes de que venza el período de prueba.
        No perderás ningún dato ni configuración.
      </td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://app.klia.com.ar/ajustes/suscripcion" style="display:inline-block;background:linear-gradient(135deg,#001a48,#002d72);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">
        Ver planes y suscribirme
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#747782;text-align:center;">
      ¿Preguntas sobre los planes? <a href="mailto:hola@klia.com.ar" style="color:#001a48;">hola@klia.com.ar</a>
    </p>
  `, 'Tu período de prueba está por vencer — KLIA')
}

export function emailCuentaBloqueada(nombre: string): string {
  return baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background-color:#fef2f2;border-radius:50%;line-height:56px;font-size:28px;">🔒</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#001a48;text-align:center;letter-spacing:-0.02em;">
      Tu cuenta fue suspendida
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#444651;line-height:1.6;text-align:center;">
      Hola <strong>${nombre}</strong>, tu período de prueba gratuita de KLIA venció y tu cuenta fue suspendida temporalmente.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:12px;margin-bottom:32px;">
      <tr><td style="padding:20px 24px;font-size:14px;color:#991b1b;line-height:1.6;">
        Tus datos están seguros. Para reactivar el acceso elegí un plan y tu consultorio quedará disponible de inmediato.
      </td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://app.klia.com.ar/ajustes/suscripcion" style="display:inline-block;background:linear-gradient(135deg,#001a48,#002d72);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">
        Reactivar mi cuenta
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#747782;text-align:center;">
      ¿Necesitás ayuda? <a href="mailto:hola@klia.com.ar" style="color:#001a48;">hola@klia.com.ar</a>
    </p>
  `, 'Tu cuenta fue suspendida — KLIA')
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
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background-color:#f0fdf4;border-radius:50%;line-height:56px;font-size:28px;">✅</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#001a48;text-align:center;letter-spacing:-0.02em;">
      ¡Pago recibido!
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#444651;line-height:1.6;text-align:center;">
      Hola <strong>${nombre}</strong>, confirmamos que recibimos tu pago.<br>
      Tu suscripción a KLIA está activa.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;border-radius:12px;margin-bottom:32px;">
      <tr><td style="padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#747782;border-bottom:1px solid #e0e3e5;">Plan</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:#001a48;text-align:right;border-bottom:1px solid #e0e3e5;">${plan}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#747782;border-bottom:1px solid #e0e3e5;">Modalidad</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:#001a48;text-align:right;border-bottom:1px solid #e0e3e5;">${modalidad}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#747782;border-bottom:1px solid #e0e3e5;">Importe</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:#001a48;text-align:right;border-bottom:1px solid #e0e3e5;">${montoFormateado}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#747782;">Próximo cobro</td>
            <td style="padding:8px 0;font-size:13px;font-weight:600;color:#001a48;text-align:right;">${proximoCobro}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://app.klia.com.ar/dashboard" style="display:inline-block;background:linear-gradient(135deg,#001a48,#002d72);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">
        Ir a mi consultorio
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#747782;text-align:center;">
      Podés gestionar tu suscripción en <a href="https://app.klia.com.ar/ajustes/suscripcion" style="color:#001a48;">Ajustes → Suscripción</a>
    </p>
  `, '¡Pago recibido! — KLIA')
}

export function emailPagoFallido(nombre: string, plan: string): string {
  return baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background-color:#fffbeb;border-radius:50%;line-height:56px;font-size:28px;">⚠️</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#001a48;text-align:center;letter-spacing:-0.02em;">
      Problema con tu pago
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#444651;line-height:1.6;text-align:center;">
      Hola <strong>${nombre}</strong>, no pudimos procesar el pago de tu suscripción al plan <strong>${plan}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:12px;margin-bottom:32px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#92400e;">¿Qué podés hacer?</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;font-size:13px;color:#92400e;">• &nbsp;Verificar que tu tarjeta tenga fondos suficientes</td></tr>
          <tr><td style="padding:4px 0;font-size:13px;color:#92400e;">• &nbsp;Actualizar el método de pago desde tu cuenta de MercadoPago</td></tr>
          <tr><td style="padding:4px 0;font-size:13px;color:#92400e;">• &nbsp;Contactarnos si el problema persiste</td></tr>
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://app.klia.com.ar/ajustes/suscripcion" style="display:inline-block;background:linear-gradient(135deg,#001a48,#002d72);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">
        Gestionar suscripción
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#747782;text-align:center;">
      ¿Necesitás ayuda? <a href="mailto:hola@klia.com.ar" style="color:#001a48;">hola@klia.com.ar</a>
    </p>
  `, 'Problema con tu pago — KLIA')
}

export function emailSuscripcionCancelada(nombre: string, fechaAcceso: string): string {
  return baseTemplate(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:56px;height:56px;background-color:#f7f9fb;border-radius:50%;line-height:56px;font-size:28px;">👋</div>
    </div>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#001a48;text-align:center;letter-spacing:-0.02em;">
      Tu suscripción fue cancelada
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#444651;line-height:1.6;text-align:center;">
      Hola <strong>${nombre}</strong>, confirmamos la cancelación de tu suscripción a KLIA.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;border-radius:12px;margin-bottom:32px;">
      <tr><td style="padding:20px 24px;font-size:14px;color:#444651;line-height:1.6;">
        Vas a poder seguir usando KLIA hasta el <strong style="color:#001a48;">${fechaAcceso}</strong>.
        A partir de esa fecha tu acceso quedará suspendido, pero todos tus datos se conservarán.
      </td></tr>
    </table>
    <p style="margin:0 0 24px;font-size:14px;color:#444651;line-height:1.6;text-align:center;">
      Si querés reactivar tu cuenta en el futuro, podés hacerlo desde Ajustes → Suscripción.<br>
      Lamentamos verte partir — si querés contarnos el motivo, escribinos.
    </p>
    <p style="margin:0;font-size:12px;color:#747782;text-align:center;">
      <a href="mailto:hola@klia.com.ar" style="color:#001a48;">hola@klia.com.ar</a>
    </p>
  `, 'Tu suscripción fue cancelada — KLIA')
}
