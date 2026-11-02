import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import { estaEnPlazo } from '@/lib/portal/plazo'

export const runtime = 'nodejs'
export const maxDuration = 15

// Solo edita el comentario — nunca la foto (eso es POST /api/portal/registros,
// que reemplaza foto + comentario juntos). Mismas reglas de plazo/habilitado
// que una subida nueva.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

  const body = await req.json().catch(() => null) as { comentario?: string } | null
  if (body?.comentario == null) {
    return NextResponse.json({ error: 'datos_invalidos', message: 'Falta el comentario.' }, { status: 400 })
  }
  const comentario = body.comentario.trim().slice(0, 300) || null

  const { data: acceso } = await db
    .from('paciente_accesos')
    .select('registro_habilitado')
    .eq('paciente_id', principal.pacienteId)
    .eq('terapeuta_id', principal.terapeutaId)
    .eq('estado', 'activo')
    .maybeSingle()
  if (!(acceso?.registro_habilitado ?? true)) {
    return NextResponse.json({ error: 'registro_pausado', message: 'Tu profesional pausó el registro de comidas.' }, { status: 403 })
  }

  const { data: registro } = await db
    .from('portal_registros')
    .select('id, fecha_local, plan_comida_id')
    .eq('id', params.id)
    .eq('paciente_id', principal.pacienteId)
    .eq('terapeuta_id', principal.terapeutaId)
    .maybeSingle()
  if (!registro) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { data: comida } = registro.plan_comida_id
    ? await db.from('plan_comidas').select('hora').eq('id', registro.plan_comida_id).maybeSingle()
    : { data: null }

  if (!estaEnPlazo(registro.fecha_local, comida?.hora ?? null, new Date())) {
    return NextResponse.json({ error: 'fuera_de_plazo', message: 'Ya pasaron más de 48 h desde esta comida.' }, { status: 403 })
  }

  const { error } = await db
    .from('portal_registros')
    .update({ comentario, updated_at: new Date().toISOString() })
    .eq('id', registro.id)
  if (error) {
    console.error('[portal/registros] error actualizando comentario')
    return NextResponse.json({ error: 'error_guardado', message: 'No pudimos guardar el comentario.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
