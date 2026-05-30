import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { enviarEmail } from '@/lib/brevo'
import {
  emailTrialDia7,
  emailTrialDia14,
  emailTrialPorVencer,
  emailTrialDia20,
  emailCuentaBloqueada,
} from '@/lib/email-templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dayWindow(daysFromNow: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  const auth = req.headers.get('authorization')
  if (!isVercelCron && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const results = { d14: 0, d7: 0, d3: 0, d1: 0, bloqueados: 0 }

  async function sendWarnings(
    users: { nombre: string; email: string }[] | null,
    buildEmail: (nombre: string) => string,
    asunto: string,
  ) {
    for (const p of users ?? []) {
      if (!p.email) continue
      try {
        await enviarEmail({
          destinatario: p.email,
          nombreDestinatario: p.nombre ?? p.email,
          asunto,
          htmlContent: buildEmail(p.nombre ?? p.email),
        })
      } catch (err) {
        console.error(`[cron] Error enviando email a ${p.email}:`, err)
      }
    }
  }

  // 14 days remaining (day 7 of trial) → "Llevás una semana en KLIA"
  const w14 = dayWindow(14)
  const { data: u14 } = await supabase.from('profiles').select('nombre, email')
    .eq('estado_cuenta', 'trial')
    .gte('trial_fin', w14.start.toISOString())
    .lte('trial_fin', w14.end.toISOString())
  await sendWarnings(u14, emailTrialDia7, 'Llevás una semana en KLIA')
  results.d14 = u14?.length ?? 0

  // 7 days remaining (day 14 of trial) → "Te quedan 7 días de prueba"
  const w7 = dayWindow(7)
  const { data: u7 } = await supabase.from('profiles').select('nombre, email')
    .eq('estado_cuenta', 'trial')
    .gte('trial_fin', w7.start.toISOString())
    .lte('trial_fin', w7.end.toISOString())
  await sendWarnings(u7, emailTrialDia14, 'Te quedan 7 días de prueba — KLIA')
  results.d7 = u7?.length ?? 0

  // 3 days remaining (day 18 of trial) → "Te quedan 3 días de prueba"
  const w3 = dayWindow(3)
  const { data: u3 } = await supabase.from('profiles').select('nombre, email')
    .eq('estado_cuenta', 'trial')
    .gte('trial_fin', w3.start.toISOString())
    .lte('trial_fin', w3.end.toISOString())
  await sendWarnings(u3, (n) => emailTrialPorVencer(n, 3), 'Te quedan 3 días de prueba — KLIA')
  results.d3 = u3?.length ?? 0

  // 1 day remaining (day 20 of trial) → "Mañana vence tu prueba"
  const w1 = dayWindow(1)
  const { data: u1 } = await supabase.from('profiles').select('nombre, email')
    .eq('estado_cuenta', 'trial')
    .gte('trial_fin', w1.start.toISOString())
    .lte('trial_fin', w1.end.toISOString())
  await sendWarnings(u1, emailTrialDia20, 'Mañana vence tu prueba — KLIA')
  results.d1 = u1?.length ?? 0

  // Block expired trials + notify (dedup via email_bloqueada_enviado)
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
      await supabase.from('profiles').update({ email_bloqueada_enviado: true }).eq('id', p.id)
    } catch (err) {
      console.error(`[cron] Error enviando email bloqueada a ${p.email}:`, err)
    }
  }
  results.bloqueados = bloqueados?.length ?? 0

  return NextResponse.json({ ...results, timestamp: new Date().toISOString() })
}
