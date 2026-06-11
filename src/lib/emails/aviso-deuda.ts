interface SesionDeuda {
  fecha: string
  descripcion: string
  monto: number
  moneda: string
}

export interface AvisoDeudaParams {
  pacienteNombre: string
  profesionalNombre: string
  profesionalEspecialidad: string
  profesionalMatricula: string | null
  profesionalEmail: string
  profesionalTelefono: string | null
  sesiones: SesionDeuda[]
  monedaTotal: string
}

function formatMonto(m: number, moneda: string): string {
  if (moneda === 'USD') return `USD ${m.toLocaleString('es-AR')}`
  if (moneda === 'EUR') return `EUR ${m.toLocaleString('es-AR')}`
  return `$${m.toLocaleString('es-AR')}`
}

export function generarEmailAvisoDeuda(params: AvisoDeudaParams): string {
  const total = params.sesiones.reduce((acc, s) => acc + s.monto, 0)
  const initials = params.profesionalNombre
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const filasTabla = params.sesiones.map((s, i) => {
    const bg = i % 2 === 1 ? 'bgcolor="#FAFBFD" style="background-color:#FAFBFD;' : 'style="'
    return `
    <tr>
      <td ${bg}padding:13px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:#444651;border-bottom:1px solid #f0f1f5;white-space:nowrap;">${s.fecha}</td>
      <td ${bg}padding:13px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;color:#444651;border-bottom:1px solid #f0f1f5;">${s.descripcion}</td>
      <td ${bg.replace('style="', 'align="right" style="')}padding:13px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13.5px;font-weight:600;color:#0B1428;border-bottom:1px solid #f0f1f5;white-space:nowrap;">${formatMonto(s.monto, s.moneda)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sesiones pendientes de pago</title></head>
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

      <tr><td style="padding:24px 40px 0 40px;border-bottom:1px solid #eef0f5;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tbody><tr>
            <td width="44" height="44" align="center" valign="middle" bgcolor="#EEF3FF" style="width:44px;height:44px;border-radius:22px;background-color:#EEF3FF;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#1F4FD9;line-height:44px;text-align:center;">${initials}</td>
            <td valign="middle" style="padding-left:14px;padding-bottom:20px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0B1428;">${params.profesionalNombre}</p>
              <p style="margin:3px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#6b7280;">${params.profesionalEspecialidad}${params.profesionalMatricula ? ` · ${params.profesionalMatricula}` : ''}</p>
            </td>
            <td align="right" valign="middle" style="padding-bottom:20px;">
              <span style="display:inline-block;background-color:#FFF7ED;border:1px solid #FDDCB5;border-radius:999px;padding:5px 13px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#C2620A;letter-spacing:0.04em;">PAGO PENDIENTE</span>
            </td>
          </tr></tbody>
        </table>
      </td></tr>

      <tr><td style="padding:32px 40px 0 40px;">
        <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1a1f2e;">
          Hola <strong style="color:#0B1428;">${params.pacienteNombre}</strong>,
        </p>
        <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#444651;">
          Espero que estés bien. Te escribo para avisarte que hay algunas sesiones en tu historial que todavía no registran pago. No es urgente, pero quería que tengas el detalle para que puedas coordinarlo cuando te sea más cómodo.
        </p>
        <p style="margin:0 0 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#444651;">
          A continuación encontrás el resumen de las sesiones pendientes:
        </p>

        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-radius:12px;overflow:hidden;border:1px solid #e8eaef;">
          <tbody>
            <tr>
              <td bgcolor="#F0F4FF" style="background-color:#F0F4FF;padding:11px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#3b5199;border-bottom:1px solid #dde4f6;" width="30%">Fecha</td>
              <td bgcolor="#F0F4FF" style="background-color:#F0F4FF;padding:11px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#3b5199;border-bottom:1px solid #dde4f6;">Descripción</td>
              <td bgcolor="#F0F4FF" align="right" style="background-color:#F0F4FF;padding:11px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#3b5199;border-bottom:1px solid #dde4f6;" width="22%">Monto</td>
            </tr>
            ${filasTabla}
            <tr>
              <td bgcolor="#EEF3FF" style="background-color:#EEF3FF;padding:15px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#1F4FD9;" colspan="2">Total pendiente</td>
              <td bgcolor="#EEF3FF" align="right" style="background-color:#EEF3FF;padding:15px 16px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#1F4FD9;white-space:nowrap;">${formatMonto(total, params.monedaTotal)}</td>
            </tr>
          </tbody>
        </table>
      </td></tr>

      <tr><td style="padding:28px 40px 36px 40px;">
        <p style="margin:0 0 22px 0;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.65;color:#444651;">
          Si ya realizaste alguno de estos pagos, podés ignorar este mensaje o avisarme para actualizar el registro. Para coordinar el pago, podés contactarme directamente por cualquiera de los medios de abajo.
        </p>
        ${params.profesionalEmail ? `
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#8a90a0;text-align:center;">
          Escribime a <a href="mailto:${params.profesionalEmail}" style="color:#1F4FD9;text-decoration:none;font-weight:600;">${params.profesionalEmail}</a>${params.profesionalTelefono ? ` o al <strong style="color:#444651;">${params.profesionalTelefono}</strong>` : ''}
        </p>` : ''}
      </td></tr>

      <tr><td style="padding:0 40px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tbody><tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:#eef0f5;">&nbsp;</td></tr></tbody>
        </table>
      </td></tr>

      <tr><td style="padding:20px 40px 32px 40px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0B1428;">${params.profesionalNombre}</p>
        <p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;">${params.profesionalEspecialidad}${params.profesionalMatricula ? ` · ${params.profesionalMatricula}` : ''}</p>
        <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#adb5c0;">
          Este mensaje fue enviado automáticamente por KLIA en nombre de tu profesional de salud.
        </p>
      </td></tr>

      </tbody>
    </table>

  </td></tr></tbody>
</table>
</body></html>`
}
