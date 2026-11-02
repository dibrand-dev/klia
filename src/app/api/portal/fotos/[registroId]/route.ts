import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoHabilitado } from '@/lib/portal/acceso'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { puedeUsarPortal } from '@/lib/portal/acceso'
import { diasRetencionPorPlan, fotoVencida } from '@/lib/portal/retencion'

export const runtime = 'nodejs'
export const maxDuration = 15

// Nunca expone pathnames ni URLs de Blob al cliente — el navegador solo ve
// esta URL propia, autenticada. Autoriza al paciente dueño (sesión de
// portal) o al profesional efectivo del paciente (incluye colaboradora).
export async function GET(req: NextRequest, { params }: { params: { registroId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 403 })

  const db = serviceClient()
  const { data: registro } = await db
    .from('portal_registros')
    .select('paciente_id, terapeuta_id, foto_path, foto_thumb_path, foto_vencida, registrado_at')
    .eq('id', params.registroId)
    .maybeSingle()
  if (!registro) return new NextResponse(null, { status: 404 })

  let autorizado = false
  if (user.app_metadata?.tipo_cuenta === 'paciente') {
    const acceso = await accesoHabilitado(db, user.id, registro.paciente_id)
    autorizado = !!acceso
  } else {
    const efectivo = await getEffectiveTerapeutaIdServer(supabase)
    autorizado = !!efectivo && efectivo.terapeutaId === registro.terapeuta_id && await puedeUsarPortal(db, efectivo.terapeutaId)
  }
  if (!autorizado) return new NextResponse(null, { status: 403 })

  const { data: profile } = await db.from('profiles').select('plan').eq('id', registro.terapeuta_id).maybeSingle()
  const diasRetencion = await diasRetencionPorPlan(db, profile?.plan ?? null)
  if (fotoVencida(registro, diasRetencion)) return new NextResponse(null, { status: 404 })

  const v = req.nextUrl.searchParams.get('v')
  const path = v === 'thumb' ? registro.foto_thumb_path : registro.foto_path
  if (!path) return new NextResponse(null, { status: 404 })

  const result = await get(path, { access: 'private' })
  if (result?.statusCode !== 200) return new NextResponse(null, { status: 404 })

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
