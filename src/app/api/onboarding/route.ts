import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, data } = body as {
    action: 'skip' | 'complete' | 'step'
    data?: Record<string, unknown>
  }

  let updates: Record<string, unknown> = {}

  if (action === 'skip') {
    updates = { onboarding_skipped: true }
  } else if (action === 'complete') {
    updates = { onboarding_completed: true, ...(data ?? {}) }
  } else if (action === 'step') {
    updates = data ?? {}
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
