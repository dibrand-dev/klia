// Templates de los 4 mails del módulo de webinars — mismo lenguaje visual
// que src/lib/emails/aviso-deuda.ts (logo + barra degradé + card blanca +
// footer), HTML propio y autocontenido porque los helpers de
// email-templates.ts son privados (no exportados) y no se pueden importar.

// `nombre` viene de un formulario público (hostil) y `titulo`/las URLs vienen
// de datos ya guardados pero igual se escapan acá, nunca se confía en texto
// libre al armar HTML — ver KL1 endurecimiento del módulo.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatearFechaHoraAR(fechaISO: string): { fecha: string; hora: string } {
  const d = new Date(fechaISO)
  const fecha = d.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const hora = d.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
  })
  return { fecha, hora }
}

function base(tituloPagina: string, eyebrow: string, contenido: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(tituloPagina)}</title></head>
<body style="margin:0;padding:0;background-color:#FBFBFC;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FBFBFC;">
  <tbody><tr><td align="center" style="padding:32px 16px 48px 16px;">

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
      <tbody><tr><td align="center" style="padding:8px 0 20px 0;">
        <a href="https://app.klia.com.ar" target="_blank" style="text-decoration:none;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#0B1428;letter-spacing:-0.03em;">KLIA</span>
        </a>
      </td></tr></tbody>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 1px 2px rgba(11,20,40,0.04),0 8px 28px rgba(11,20,40,0.07);overflow:hidden;">
      <tbody>
      <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background-color:#1F4FD9;background-image:linear-gradient(90deg,#001a48 0%,#1F4FD9 100%);">&nbsp;</td></tr>

      <tr><td style="padding:32px 40px 0 40px;">
        <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1F4FD9;">${eyebrow}</p>
        ${contenido}
      </td></tr>

      <tr><td style="padding:0 40px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tbody><tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:#eef0f5;">&nbsp;</td></tr></tbody>
        </table>
      </td></tr>

      <tr><td style="padding:20px 40px 32px 40px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0B1428;">El equipo de KLIA</p>
        <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#adb5c0;">
          Recibís este mail porque te inscribiste a un webinar gratuito de KLIA.
        </p>
      </td></tr>

      </tbody>
    </table>

  </td></tr></tbody>
</table>
</body></html>`
}

function detalleEvento(tituloSafe: string, fecha: string, hora: string, duracionMin: number): string {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:18px;border-radius:12px;border:1px solid #e8eaef;">
      <tbody>
        <tr><td style="padding:16px 18px;">
          <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0B1428;">${tituloSafe}</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:1.6;color:#444651;text-transform:capitalize;">${fecha}</p>
          <p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:1.6;color:#444651;">${hora} hs (Argentina) · ${duracionMin} min</p>
        </td></tr>
      </tbody>
    </table>`
}

// `url` se escapa acá adentro (no en cada call site) para cubrir las 3 URLs
// dinámicas que entran a un atributo href en este archivo (link de la
// videoconferencia, de Google Calendar, y del CTA post-evento) desde un
// solo lugar.
function boton(texto: string, url: string, color = '#1F4FD9'): string {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto 0;">
      <tbody><tr>
        <td align="center" bgcolor="${color}" style="background-color:${color};border-radius:10px;">
          <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${texto}</a>
        </td>
      </tr></tbody>
    </table>`
}

function botonSecundario(texto: string, url: string): string {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin:12px auto 0;">
      <tbody><tr>
        <td align="center" style="border:1px solid #d8dde6;border-radius:10px;">
          <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:11px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#444651;text-decoration:none;border-radius:10px;">${texto}</a>
        </td>
      </tr></tbody>
    </table>`
}

interface WebinarEmailBase {
  nombre: string
  titulo: string
  fecha_inicio: string
  duracion_min: number
  url_videoconferencia: string
  urlAgendar: string
}

export function emailConfirmacionWebinar(p: WebinarEmailBase): string {
  const nombre = escapeHtml(p.nombre)
  const titulo = escapeHtml(p.titulo)
  const { fecha, hora } = formatearFechaHoraAR(p.fecha_inicio)
  const contenido = `
    <h1 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:21px;font-weight:700;color:#0B1428;letter-spacing:-0.01em;">¡Listo, ${nombre}! Tu lugar está confirmado</h1>
    <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.65;color:#444651;">
      Guardá esta fecha — te vamos a estar esperando. Te vamos a enviar un recordatorio el día anterior y otro 30 minutos antes. El link de acceso ya lo tenés acá.
    </p>
    ${detalleEvento(titulo, fecha, hora, p.duracion_min)}
    ${boton('Unirme al webinar', p.url_videoconferencia)}
    ${botonSecundario('Agregar a Google Calendar', p.urlAgendar)}
  `
  return base(`Confirmación — ${p.titulo}`, 'Inscripción confirmada', contenido)
}

export function emailRecordatorio1dWebinar(p: WebinarEmailBase): string {
  const nombre = escapeHtml(p.nombre)
  const titulo = escapeHtml(p.titulo)
  const { fecha, hora } = formatearFechaHoraAR(p.fecha_inicio)
  const contenido = `
    <h1 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:21px;font-weight:700;color:#0B1428;letter-spacing:-0.01em;">Mañana es el webinar, ${nombre}</h1>
    <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.65;color:#444651;">
      Te escribimos para recordarte que mañana es "${titulo}". Dejamos el link de acceso acá para que lo tengas a mano.
    </p>
    ${detalleEvento(titulo, fecha, hora, p.duracion_min)}
    ${boton('Unirme al webinar', p.url_videoconferencia)}
    ${botonSecundario('Agregar a Google Calendar', p.urlAgendar)}
  `
  return base(`Recordatorio — ${p.titulo}`, 'Es mañana', contenido)
}

export function emailRecordatorio30mWebinar(p: WebinarEmailBase): string {
  const nombre = escapeHtml(p.nombre)
  const titulo = escapeHtml(p.titulo)
  const { hora } = formatearFechaHoraAR(p.fecha_inicio)
  const contenido = `
    <h1 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:21px;font-weight:700;color:#0B1428;letter-spacing:-0.01em;">${titulo} empieza en 30 minutos</h1>
    <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.65;color:#444651;">
      Hola ${nombre}, en media hora (${hora} hs, Argentina) arrancamos. Te dejamos el link para que entres cuando quieras.
    </p>
    ${boton('Unirme ahora', p.url_videoconferencia)}
  `
  return base(`${p.titulo} — empieza en 30 minutos`, 'Empieza en 30 minutos', contenido)
}

interface WebinarPostEventoParams {
  nombre: string
  titulo: string
  slug: string
}

export function emailPostEventoWebinar(p: WebinarPostEventoParams): string {
  const nombre = escapeHtml(p.nombre)
  const titulo = escapeHtml(p.titulo)
  const ctaUrl = `https://www.klia.com.ar/registro?utm_source=webinar&utm_medium=email&utm_campaign=${encodeURIComponent(p.slug)}`
  const contenido = `
    <h1 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:21px;font-weight:700;color:#0B1428;letter-spacing:-0.01em;">¡Gracias por participar, ${nombre}!</h1>
    <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.65;color:#444651;">
      Esperamos que "${titulo}" te haya servido. Si querés seguir ordenando tu consultorio con todo lo que vimos, te invitamos a probar KLIA gratis durante 21 días, sin tarjeta.
    </p>
    ${boton('Probá KLIA 21 días gratis', ctaUrl)}
  `
  return base(`Gracias por participar — ${p.titulo}`, 'Gracias por venir', contenido)
}
