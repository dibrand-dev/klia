import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'

export const runtime = 'nodejs'
export const maxDuration = 10

// Idempotente: solo el paciente dueño, solo si hay comentario del
// profesional. No hace falta que el acceso siga "habilitado para registrar"
// (registro_habilitado es sobre subir fotos nuevas, no sobre ver/marcar como
// visto un comentario ya existente) — por eso usa accesoPrincipal (gate de
// puedeUsarPortal) y no una verificación aparte de registro_habilitado.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

  const { data: registro } = await db
    .from('portal_registros')
    .select('id, comentario_profesional')
    .eq('id', params.id)
    .eq('paciente_id', principal.pacienteId)
    .eq('terapeuta_id', principal.terapeutaId)
    .maybeSingle()
  if (!registro) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (registro.comentario_profesional) {
    await db.from('portal_registros').update({ comentario_visto_at: new Date().toISOString() }).eq('id', registro.id)
  }

  return NextResponse.json({ ok: true })
}
