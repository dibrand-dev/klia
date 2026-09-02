import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SupabaseWebhookPayload {
  type: string
  table: string
  schema: string
  record: {
    nombre?: string | null
    apellido?: string | null
    email?: string | null
    especialidad?: string | null
    tipo_cuenta?: string | null
    [key: string]: unknown
  } | null
  old_record: unknown
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json() as SupabaseWebhookPayload
  const record = payload.record

  if (record?.tipo_cuenta === 'colaborador') {
    return NextResponse.json({ ok: true })
  }

  const nombreCompleto = [record?.nombre, record?.apellido].filter(Boolean).join(' ').trim()
  const lineas = [
    nombreCompleto || 'Sin nombre',
    record?.email || null,
    record?.especialidad || null,
  ].filter(Boolean)

  try {
    const res = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: process.env.PUSHOVER_API_TOKEN ?? '',
        user: process.env.PUSHOVER_USER_KEY ?? '',
        title: 'Nuevo registro en KLIA',
        message: lineas.join('\n'),
        priority: '0',
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[webhooks/nuevo-registro] Pushover error:', res.status, body)
    }
  } catch (err) {
    console.error('[webhooks/nuevo-registro] Error llamando a Pushover:', err)
  }

  return NextResponse.json({ ok: true })
}
