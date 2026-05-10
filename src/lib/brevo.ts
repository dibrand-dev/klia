// Emails transaccionales de KLIA gestionados via Brevo.
// Los templates de Supabase (Confirm signup, Magic link, Reset password)
// deben estar vaciados en Authentication → Email Templates del dashboard.
import { BrevoClient } from '@getbrevo/brevo'

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY!,
})

export const REMITENTE = {
  name: 'KLIA',
  email: 'hola@klia.com.ar',
}

export async function enviarEmail({
  destinatario,
  nombreDestinatario,
  asunto,
  htmlContent,
}: {
  destinatario: string
  nombreDestinatario: string
  asunto: string
  htmlContent: string
}): Promise<void> {
  await client.transactionalEmails.sendTransacEmail({
    sender: REMITENTE,
    to: [{ email: destinatario, name: nombreDestinatario }],
    subject: asunto,
    htmlContent,
  })
}
