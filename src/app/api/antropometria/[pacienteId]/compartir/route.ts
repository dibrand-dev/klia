import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { pacienteAntropometriaPerteneceATerapeuta } from '@/lib/antropometria/compartido-ownership'
import { formatNombreCompleto } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function generarToken(): string {
  // >=32 chars, aleatorio, generado en el servidor — mismo patrón que
  // src/app/api/planes-alimentarios/[id]/compartir/route.ts.
  return randomBytes(32).toString('base64url')
}

export async function GET(request: NextRequest, { params }: { params: { pacienteId: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const pertenece = await pacienteAntropometriaPerteneceATerapeuta(db, params.pacienteId, efectivo.terapeutaId)
  if (!pertenece) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const [{ data: activo, error }, { data: profile }] = await Promise.all([
    db
      .from('antropometria_compartidos')
      .select('token, creado_en, vence_en, enviado_a, enviado_en')
      .eq('paciente_id', params.pacienteId)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .is('revocado_en', null)
      .maybeSingle(),
    db.from('profiles').select('nombre, apellido').eq('id', efectivo.terapeutaId).single(),
  ])

  if (error) {
    console.error('[antropometria/compartir GET] DB error:', error)
    return NextResponse.json({ error: 'Error al obtener el link' }, { status: 500 })
  }

  let ultimoRevocadoEn: string | null = null
  if (!activo) {
    const { data: revocado } = await db
      .from('antropometria_compartidos')
      .select('revocado_en')
      .eq('paciente_id', params.pacienteId)
      .eq('terapeuta_id', efectivo.terapeutaId)
      .not('revocado_en', 'is', null)
      .order('revocado_en', { ascending: false })
      .limit(1)
      .maybeSingle()
    ultimoRevocadoEn = revocado?.revocado_en ?? null
  }

  const profesionalNombre = profile ? formatNombreCompleto(profile.nombre, profile.apellido) : ''

  return NextResponse.json({ share: activo ?? null, ultimoRevocadoEn, profesionalNombre })
}

export async function POST(request: NextRequest, { params }: { params: { pacienteId: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const pertenece = await pacienteAntropometriaPerteneceATerapeuta(db, params.pacienteId, efectivo.terapeutaId)
  if (!pertenece) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const { data: activo } = await db
    .from('antropometria_compartidos')
    .select('token, creado_en, vence_en, enviado_a, enviado_en')
    .eq('paciente_id', params.pacienteId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .is('revocado_en', null)
    .maybeSingle()

  if (activo) return NextResponse.json({ share: activo })

  const { data: nuevo, error } = await db
    .from('antropometria_compartidos')
    .insert({
      paciente_id: params.pacienteId,
      terapeuta_id: efectivo.terapeutaId,
      token: generarToken(),
      vence_en: null,
    })
    .select('token, creado_en, vence_en, enviado_a, enviado_en')
    .single()

  if (error) {
    console.error('[antropometria/compartir POST] DB error:', error)
    return NextResponse.json({ error: 'Error al crear el link' }, { status: 500 })
  }

  return NextResponse.json({ share: nuevo })
}

export async function PATCH(request: NextRequest, { params }: { params: { pacienteId: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const pertenece = await pacienteAntropometriaPerteneceATerapeuta(db, params.pacienteId, efectivo.terapeutaId)
  if (!pertenece) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const body = await request.json()
  const exp = body?.exp as string | undefined
  if (exp !== 'none' && exp !== '30' && exp !== '90') {
    return NextResponse.json({ error: 'exp inválido' }, { status: 400 })
  }

  const { data: activo } = await db
    .from('antropometria_compartidos')
    .select('id, creado_en')
    .eq('paciente_id', params.pacienteId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .is('revocado_en', null)
    .maybeSingle()

  if (!activo) return NextResponse.json({ error: 'No hay un link activo para este paciente' }, { status: 404 })

  const venceEn = exp === 'none' ? null : new Date(new Date(activo.creado_en).getTime() + Number(exp) * 86400000).toISOString()

  const { data: actualizado, error } = await db
    .from('antropometria_compartidos')
    .update({ vence_en: venceEn })
    .eq('id', activo.id)
    .select('token, creado_en, vence_en, enviado_a, enviado_en')
    .single()

  if (error) {
    console.error('[antropometria/compartir PATCH] DB error:', error)
    return NextResponse.json({ error: 'Error al actualizar el vencimiento' }, { status: 500 })
  }

  return NextResponse.json({ share: actualizado })
}

export async function DELETE(request: NextRequest, { params }: { params: { pacienteId: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const pertenece = await pacienteAntropometriaPerteneceATerapeuta(db, params.pacienteId, efectivo.terapeutaId)
  if (!pertenece) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const { error } = await db
    .from('antropometria_compartidos')
    .update({ revocado_en: new Date().toISOString() })
    .eq('paciente_id', params.pacienteId)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .is('revocado_en', null)

  if (error) {
    console.error('[antropometria/compartir DELETE] DB error:', error)
    return NextResponse.json({ error: 'Error al dejar de compartir el informe' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
