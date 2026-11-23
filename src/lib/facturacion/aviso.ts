import { enviarEmail } from '@/lib/brevo'
import { emailDatosFacturacion } from '@/lib/email-templates'
import type { serviceClient } from '@/lib/supabase/service'

type Db = ReturnType<typeof serviceClient>
type EnviarEmailFn = typeof enviarEmail

// Avisa una sola vez por profesional de que le faltan los datos de
// facturación (CUIT/condición IVA/razón social) tras un pago de suscripción
// aprobado. Idempotente vía profiles.facturacion_aviso_enviado_at — nunca
// lanza, para no afectar la confirmación del pago que la dispara.
export async function avisarDatosFacturacion(
  db: Db,
  terapeutaId: string,
  deps: { enviarEmail: EnviarEmailFn } = { enviarEmail },
): Promise<void> {
  try {
    // Reclamo atómico: solo si cuit es null y todavía no se avisó. Si otra
    // corrida (u otro pago en simultáneo) ya lo reclamó, no devuelve fila.
    const { data: reclamado } = await db
      .from('profiles')
      .update({ facturacion_aviso_enviado_at: new Date().toISOString() })
      .eq('id', terapeutaId)
      .is('cuit', null)
      .is('facturacion_aviso_enviado_at', null)
      .select('nombre, email')
      .maybeSingle()

    if (!reclamado) return

    if (!reclamado.email) {
      await db.from('profiles').update({ facturacion_aviso_enviado_at: null }).eq('id', terapeutaId)
      return
    }

    try {
      await deps.enviarEmail({
        destinatario: reclamado.email,
        nombreDestinatario: reclamado.nombre ?? reclamado.email,
        asunto: 'Completá tus datos de facturación en KLIA',
        htmlContent: emailDatosFacturacion({ nombre: reclamado.nombre ?? reclamado.email }),
      })
    } catch (err) {
      console.error('[avisarDatosFacturacion] error al enviar el mail, se revierte la marca para reintentar', terapeutaId, err)
      await db.from('profiles').update({ facturacion_aviso_enviado_at: null }).eq('id', terapeutaId)
    }
  } catch (err) {
    console.error('[avisarDatosFacturacion] error inesperado', terapeutaId, err)
  }
}
