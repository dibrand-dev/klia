function baseTemplate(contenido: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);border:1px solid #E5E7EB;">
        <tr><td style="background:#ffffff;padding:32px 40px;text-align:center;border-bottom:1px solid #E5E7EB;">
          <img src="https://app.klia.com.ar/logo-email.png" alt="KLIA" width="200" height="99" style="display:block;margin:0 auto;" />
        </td></tr>
        <tr><td style="padding:40px;">
          ${contenido}
        </td></tr>
        <tr><td style="padding:24px 40px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            <a href="https://app.klia.com.ar" style="color:#2563EB;text-decoration:none;">app.klia.com.ar</a> ·
            <a href="mailto:hola@klia.com.ar" style="color:#2563EB;text-decoration:none;">hola@klia.com.ar</a>
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
    <h2 style="color:#1F2937;font-size:22px;font-weight:700;margin:0 0 16px;">Confirmá tu cuenta</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola <strong>${nombre}</strong>, gracias por registrarte en KLIA.
      Para activar tu cuenta hacé clic en el botón de abajo.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
      <tr><td align="center">
        <a href="${urlConfirmacion}"
           style="display:inline-block;background:#2563EB;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Confirmar mi cuenta
        </a>
      </td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 8px;">
      Si el botón no funciona, copiá y pegá este enlace en tu navegador:
    </p>
    <p style="color:#2563EB;font-size:13px;word-break:break-all;margin:0 0 24px;">
      <a href="${urlConfirmacion}" style="color:#2563EB;">${urlConfirmacion}</a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:0;">
      Este enlace expira en 24 horas. Si no creaste esta cuenta, podés ignorar este email.
    </p>
  `)
}

export function emailBienvenida(nombre: string, diasPrueba: number): string {
  return baseTemplate(`
    <h2 style="color:#1F2937;font-size:22px;font-weight:700;margin:0 0 16px;">¡Bienvenido/a a KLIA, ${nombre}!</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Tu cuenta está activa y podés empezar a usar KLIA ahora mismo.
      Tenés <strong>${diasPrueba} días de prueba gratuita</strong> con acceso completo a todas las funcionalidades.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border-radius:8px;padding:20px;margin:0 0 28px;">
      <tr><td>
        <p style="color:#1F2937;font-size:14px;font-weight:600;margin:0 0 12px;">¿Qué podés hacer en KLIA?</p>
        <ul style="color:#374151;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Gestionar tu agenda y turnos online</li>
          <li>Llevar fichas clínicas de cada paciente</li>
          <li>Registrar pagos y generar liquidaciones de obras sociales</li>
          <li>Generar planillas de asistencia en PDF</li>
          <li>Interconsultas con colegas</li>
        </ul>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="https://app.klia.com.ar/dashboard"
           style="display:inline-block;background:#2563EB;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Ir a mi consultorio
        </a>
      </td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
      Si tenés dudas escribinos a <a href="mailto:hola@klia.com.ar" style="color:#2563EB;">hola@klia.com.ar</a>.
    </p>
  `)
}

export function emailTrialPorVencer(nombre: string, diasRestantes: number): string {
  return baseTemplate(`
    <h2 style="color:#1F2937;font-size:22px;font-weight:700;margin:0 0 16px;">Tu período de prueba está por vencer</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Hola <strong>${nombre}</strong>, te avisamos que tu prueba gratuita de KLIA vence en
      <strong style="color:#f59e0b;">${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:20px;margin:0 0 28px;">
      <tr><td>
        <p style="color:#92400e;font-size:14px;margin:0;">
          Para seguir usando KLIA sin interrupciones, elegí un plan antes de que venza el período de prueba.
          No perderás ningún dato ni configuración.
        </p>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="https://app.klia.com.ar/ajustes/suscripcion"
           style="display:inline-block;background:#2563EB;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Ver planes y suscribirme
        </a>
      </td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
      ¿Tenés preguntas sobre los planes? Escribinos a <a href="mailto:hola@klia.com.ar" style="color:#2563EB;">hola@klia.com.ar</a>.
    </p>
  `)
}

export function emailCuentaBloqueada(nombre: string): string {
  return baseTemplate(`
    <h2 style="color:#ef4444;font-size:22px;font-weight:700;margin:0 0 16px;">Tu cuenta fue suspendida</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Hola <strong>${nombre}</strong>, tu período de prueba gratuita de KLIA venció y tu cuenta fue suspendida temporalmente.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:0 0 28px;">
      <tr><td>
        <p style="color:#991b1b;font-size:14px;margin:0;">
          Tus datos están seguros. Para reactivar el acceso elegí un plan y tu consultorio quedará disponible de inmediato.
        </p>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="https://app.klia.com.ar/ajustes/suscripcion"
           style="display:inline-block;background:#ef4444;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Reactivar mi cuenta
        </a>
      </td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
      ¿Necesitás ayuda? Contactanos en <a href="mailto:hola@klia.com.ar" style="color:#2563EB;">hola@klia.com.ar</a>.
    </p>
  `)
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
    <h2 style="color:#10b981;font-size:22px;font-weight:700;margin:0 0 16px;">¡Pago recibido!</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Hola <strong>${nombre}</strong>, confirmamos que recibimos tu pago. Tu suscripción a KLIA está activa.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 28px;">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#6b7280;font-size:14px;padding:6px 0;">Plan</td>
            <td style="color:#1F2937;font-size:14px;font-weight:600;text-align:right;padding:6px 0;">${plan}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:14px;padding:6px 0;">Modalidad</td>
            <td style="color:#1F2937;font-size:14px;font-weight:600;text-align:right;padding:6px 0;">${modalidad}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:14px;padding:6px 0;">Importe</td>
            <td style="color:#1F2937;font-size:14px;font-weight:600;text-align:right;padding:6px 0;">${montoFormateado}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:14px;padding:6px 0;">Próximo cobro</td>
            <td style="color:#1F2937;font-size:14px;font-weight:600;text-align:right;padding:6px 0;">${proximoCobro}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="https://app.klia.com.ar/dashboard"
           style="display:inline-block;background:#2563EB;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Ir a mi consultorio
        </a>
      </td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin:0;">
      Podés gestionar tu suscripción en <a href="https://app.klia.com.ar/ajustes/suscripcion" style="color:#2563EB;">Ajustes → Suscripción</a>.
    </p>
  `)
}

export function emailPagoFallido(nombre: string, plan: string): string {
  return baseTemplate(`
    <h2 style="color:#ef4444;font-size:22px;font-weight:700;margin:0 0 16px;">Problema con tu pago</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Hola <strong>${nombre}</strong>, no pudimos procesar el pago de tu suscripción al plan <strong>${plan}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:0 0 28px;">
      <tr><td>
        <p style="color:#991b1b;font-size:14px;margin:0 0 8px;font-weight:600;">¿Qué podés hacer?</p>
        <ul style="color:#991b1b;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Verificar que tu tarjeta tenga fondos suficientes</li>
          <li>Actualizar el método de pago desde tu cuenta de MercadoPago</li>
          <li>Contactarnos si el problema persiste</li>
        </ul>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="https://app.klia.com.ar/ajustes/suscripcion"
           style="display:inline-block;background:#ef4444;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Gestionar suscripción
        </a>
      </td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin:0;">
      ¿Necesitás ayuda? Escribinos a <a href="mailto:hola@klia.com.ar" style="color:#2563EB;">hola@klia.com.ar</a>.
    </p>
  `)
}

export function emailSuscripcionCancelada(nombre: string, fechaAcceso: string): string {
  return baseTemplate(`
    <h2 style="color:#1F2937;font-size:22px;font-weight:700;margin:0 0 16px;">Tu suscripción fue cancelada</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Hola <strong>${nombre}</strong>, confirmamos la cancelación de tu suscripción a KLIA.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin:0 0 28px;">
      <tr><td>
        <p style="color:#374151;font-size:14px;margin:0;">
          Vas a poder seguir usando KLIA hasta el <strong>${fechaAcceso}</strong>.
          A partir de esa fecha tu acceso quedará suspendido pero todos tus datos se conservarán.
        </p>
      </td></tr>
    </table>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Si querés reactivar tu cuenta en el futuro, podés hacerlo desde Ajustes → Suscripción.
      Lamentamos verte partir — si querés contarnos el motivo de la cancelación, escribinos.
    </p>
    <p style="color:#6b7280;font-size:13px;margin:0;">
      <a href="mailto:hola@klia.com.ar" style="color:#2563EB;">hola@klia.com.ar</a>
    </p>
  `)
}
