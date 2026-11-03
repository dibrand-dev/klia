import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { puedeUsarPortal } from '@/lib/portal/acceso'
import { diasRetencionPorPlan, fotoVencida } from '@/lib/portal/retencion'
import { armarComentarioProfesional, formatNombreProfesional } from '@/lib/portal/comentario-profesional'

export const runtime = 'nodejs'
export const maxDuration = 10

// Solo lo escribe el profesional dueño — nunca la colaboradora (ve el
// comentario en el GET, pero este PUT siempre le devuelve 403). "Foto
// vencida" se calcula en vivo (mismo helper que el resto del portal), no
// depende de que el cron ya haya corrido hoy.
export async function PUT(req: NextRequest, { params }: { params: { id: string; registroId: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (efectivo.esColaborador) {
    return NextResponse.json({ error: 'colaboradora_no_puede_comentar', message: 'Solo el profesional puede comentar.' }, { status: 403 })
  }

  const db = serviceClient()
  const habilitado = await puedeUsarPortal(db, efectivo.terapeutaId)
  if (!habilitado) {
    return NextResponse.json({ error: 'portal_no_habilitado', message: 'Tu plan no incluye el portal del paciente.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { texto?: string } | null
  if (body?.texto == null) {
    return NextResponse.json({ error: 'datos_invalidos', message: 'Falta el texto del comentario.' }, { status: 400 })
  }
  const texto = body.texto.trim().slice(0, 500) || null

  const { data: registro } = await db
    .from('portal_registros')
    .select('id, foto_vencida, registrado_at, comentario_profesional, comentario_profesional_at, comentario_visto_at')
    .eq('id', params.registroId)
    .eq('paciente_id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()
  if (!registro) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { data: profile } = await db.from('profiles').select('plan, nombre, apellido').eq('id', efectivo.terapeutaId).maybeSingle()
  const diasRetencion = await diasRetencionPorPlan(db, profile?.plan ?? null)
  if (fotoVencida(registro, diasRetencion)) {
    return NextResponse.json({ error: 'foto_vencida', message: 'La foto venció, ya no se puede comentar.' }, { status: 409 })
  }

  const habiaComentario = !!registro.comentario_profesional
  const ahora = new Date().toISOString()

  const dbUpdate = texto
    ? {
        comentario_profesional: texto,
        comentario_profesional_por: efectivo.terapeutaId,
        comentario_profesional_at: habiaComentario ? registro.comentario_profesional_at : ahora,
        comentario_profesional_editado_at: habiaComentario ? ahora : null,
        ...(habiaComentario ? {} : { comentario_visto_at: null }),
      }
    : {
        comentario_profesional: null,
        comentario_profesional_at: null,
        comentario_profesional_editado_at: null,
        comentario_profesional_por: null,
        comentario_visto_at: null,
      }

  const { error } = await db.from('portal_registros').update(dbUpdate).eq('id', registro.id)
  if (error) {
    console.error('[pacientes/portal/registros/comentario] error guardando')
    return NextResponse.json({ error: 'error_guardado', message: 'No pudimos guardar el comentario.' }, { status: 500 })
  }

  if (!texto) return NextResponse.json({ ok: true, comentario: null })

  const nombreActual = formatNombreProfesional(profile?.nombre ?? null, profile?.apellido ?? null)
  const comentarioOut = armarComentarioProfesional(
    {
      comentario_profesional: texto,
      comentario_profesional_at: dbUpdate.comentario_profesional_at ?? ahora,
      comentario_profesional_editado_at: dbUpdate.comentario_profesional_editado_at,
      comentario_visto_at: habiaComentario ? registro.comentario_visto_at : null,
    },
    nombreActual,
  )

  return NextResponse.json({ ok: true, comentario: comentarioOut })
}
