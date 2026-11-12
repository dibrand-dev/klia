import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { intentarGenerarImagen } from '@/lib/food-images'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// `vademecum_alimentos` es catálogo compartido (no por terapeuta) — alcanza
// con exigir cualquier usuario autenticado, no getEffectiveTerapeutaIdServer.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await intentarGenerarImagen(params.id)

  const db = serviceClient()
  const { data } = await db.from('vademecum_alimentos').select('image_url, image_status').eq('id', params.id).maybeSingle()

  return NextResponse.json({ status: data?.image_status ?? 'pending', image_url: data?.image_url ?? null })
}
