import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: colaboradores, error } = await supabase
    .from('colaboradores')
    .select('id, colaborador_id, activo, invitacion_aceptada, invitado_en, aceptado_en')
    .eq('profesional_id', user.id)
    .order('invitado_en', { ascending: false })

  if (error) {
    console.error('[colaboradores] Error listando colaboradores:', error)
    return NextResponse.json({ error: 'Error al listar colaboradoras' }, { status: 500 })
  }

  const db = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const colaboradorIds = (colaboradores ?? []).map((c) => c.colaborador_id)
  const { data: perfiles } = colaboradorIds.length > 0
    ? await db.from('profiles').select('id, nombre, apellido, email').in('id', colaboradorIds)
    : { data: [] }

  const perfilMap = new Map((perfiles ?? []).map((p) => [p.id, p]))

  const lista = (colaboradores ?? []).map((c) => {
    const perfil = perfilMap.get(c.colaborador_id)
    return {
      id: c.id,
      email: perfil?.email ?? null,
      nombre: perfil?.nombre ?? null,
      apellido: perfil?.apellido ?? null,
      activo: c.activo,
      invitacion_aceptada: c.invitacion_aceptada,
      invitado_en: c.invitado_en,
      aceptado_en: c.aceptado_en,
    }
  })

  return NextResponse.json({ colaboradores: lista })
}
