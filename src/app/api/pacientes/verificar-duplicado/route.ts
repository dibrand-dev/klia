import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { normalizarDni, normalizarEmail, escaparIlike } from '@/lib/pacientes/duplicados'

export const runtime = 'nodejs'

function db() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type Coincidencia = { id: string; nombre: string; apellido: string; activo: boolean }

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { dni?: string; email?: string; nombre?: string; apellido?: string }
  const dniBuscado = normalizarDni(body.dni)
  const emailBuscado = normalizarEmail(body.email)

  const service = db()
  const resultado: { dni: Coincidencia[]; email: Coincidencia[] } = { dni: [], email: [] }

  if (dniBuscado) {
    const { data } = await service
      .from('pacientes')
      .select('id, nombre, apellido, activo, dni')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .not('dni', 'is', null)
    resultado.dni = (data ?? [])
      .filter((p) => normalizarDni(p.dni) === dniBuscado)
      .map((p) => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, activo: p.activo }))
  }

  if (emailBuscado) {
    const { data } = await service
      .from('pacientes')
      .select('id, nombre, apellido, activo')
      .eq('terapeuta_id', efectivo.terapeutaId)
      .ilike('email', escaparIlike(emailBuscado))
    resultado.email = (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, activo: p.activo }))
  }

  return NextResponse.json(resultado)
}
