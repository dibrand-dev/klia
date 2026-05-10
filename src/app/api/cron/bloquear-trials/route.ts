import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { enviarEmail } from '@/lib/brevo'
import { emailTrialPorVencer, emailCuentaBloqueada } from '@/lib/email-templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 1. Avisar a quienes les vencen el trial en 3 días
  const en3dias = new Date()
  en3dias.setDate(en3dias.getDate() + 3)
  const dia3inicio = new Date(en3dias)
  dia3inicio.setHours(0, 0, 0, 0)
  const dia3fin = new Date(en3dias)
  dia3fin.setHours(23, 59, 59, 999)

  const { data: porVencer } = await supabase
    .from('profiles')
    .select('id, nombre, email')
    .eq('estado_cuenta', 'trial')
    .gte('trial_fin', dia3inicio.toISOString())
    .lte('trial_fin', dia3fin.toISOString())

  for (const p of porVencer ?? []) {
    if (!p.email) continue
    try {
      await enviarEmail({
        destinatario: p.email,
        nombreDestinatario: p.nombre ?? p.email,
        asunto: 'Tu período de prueba de KLIA vence en 3 días',
        htmlContent: emailTrialPorVencer(p.nombre ?? p.email, 3),
      })
    } catch (err) {
      console.error(`Error enviando aviso trial a ${p.email}:`, err)
    }
  }

  // 2. Bloquear trials vencidos y notificar (solo una vez via email_bloqueada_enviado)
  const { data: bloqueados, error } = await supabase
    .from('profiles')
    .update({ estado_cuenta: 'bloqueada' })
    .eq('estado_cuenta', 'trial')
    .lt('trial_fin', new Date().toISOString())
    .select('id, nombre, email, email_bloqueada_enviado')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const p of bloqueados ?? []) {
    if (!p.email || p.email_bloqueada_enviado) continue
    try {
      await enviarEmail({
        destinatario: p.email,
        nombreDestinatario: p.nombre ?? p.email,
        asunto: 'Tu cuenta de KLIA fue suspendida',
        htmlContent: emailCuentaBloqueada(p.nombre ?? p.email),
      })
      await supabase
        .from('profiles')
        .update({ email_bloqueada_enviado: true })
        .eq('id', p.id)
    } catch (err) {
      console.error(`Error enviando email bloqueada a ${p.email}:`, err)
    }
  }

  return NextResponse.json({
    bloqueados: bloqueados?.length ?? 0,
    avisos_trial: porVencer?.length ?? 0,
    timestamp: new Date().toISOString(),
  })
}
