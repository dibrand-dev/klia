import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { enviarEmail } from '@/lib/brevo'
import { emailInactividadTrial } from '@/lib/email-templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  const { data: inactivos, error } = await supabase.rpc('get_inactive_trial_profiles')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = { procesados: inactivos?.length ?? 0, enviados: 0, errores: 0 }

  for (const p of inactivos ?? []) {
    if (!p.email) continue
    try {
      await enviarEmail({
        destinatario: p.email,
        nombreDestinatario: p.nombre ?? p.email,
        asunto: '¿Necesitás una mano con KLIA?',
        htmlContent: emailInactividadTrial(p.nombre ?? p.email),
      })
      await supabase.from('profiles').update({ email_inactividad_enviado_at: new Date().toISOString() }).eq('id', p.id)
      console.log(`[cron/inactividad-trial] Email enviado a profesional ${p.id}`)
      results.enviados++
    } catch (err) {
      console.error(`[cron/inactividad-trial] Error enviando email a profesional ${p.id}:`, err)
      results.errores++
    }
  }

  return NextResponse.json({ ...results, timestamp: new Date().toISOString() })
}
