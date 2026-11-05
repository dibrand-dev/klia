import { NextRequest, NextResponse } from 'next/server'
import { put, del, get } from '@vercel/blob'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { tipoImagenReal } from '@/lib/portal/magic-bytes'

export const runtime = 'nodejs'
export const maxDuration = 15

const MAX_FOTO_BYTES = 1024 * 1024

type PacienteAvatarRow = { avatar_path: string | null }

async function pacienteDelTerapeuta(
  db: ReturnType<typeof serviceClient>,
  pacienteId: string,
  terapeutaId: string,
): Promise<PacienteAvatarRow | null> {
  const { data } = await db
    .from('pacientes')
    .select('avatar_path')
    .eq('id', pacienteId)
    .eq('terapeuta_id', terapeutaId)
    .maybeSingle()
  return data ?? null
}

// Best-effort: nunca interrumpe la respuesta por un blob viejo que no se pudo
// borrar — se loguea sin el pathname (mismo criterio que portal/registros).
async function borrarBlobAnterior(path: string | null, pacienteId: string) {
  if (!path) return
  try {
    await del(path)
  } catch {
    console.error(`[pacientes/foto] no se pudo borrar el blob anterior del paciente ${pacienteId}`)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const paciente = await pacienteDelTerapeuta(db, params.id, efectivo.terapeutaId)
  if (!paciente) return NextResponse.json({ error: 'no_encontrado' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'form_invalido', message: 'No pudimos leer la solicitud.' }, { status: 400 })

  const fotoFile = form.get('foto')
  if (!(fotoFile instanceof File)) {
    return NextResponse.json({ error: 'falta_archivo', message: 'Falta la foto.' }, { status: 400 })
  }
  if (fotoFile.size > MAX_FOTO_BYTES) {
    return NextResponse.json({ error: 'archivo_muy_grande', message: 'La foto es demasiado grande.' }, { status: 413 })
  }

  const fotoBuf = Buffer.from(await fotoFile.arrayBuffer())
  if (tipoImagenReal(fotoBuf) !== 'jpeg') {
    return NextResponse.json({ error: 'tipo_invalido', message: 'El archivo no es una imagen válida.' }, { status: 400 })
  }

  const path = `pacientes-avatar/${params.id}/${Date.now()}.jpg`
  await put(path, fotoBuf, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true })

  const { error } = await db
    .from('pacientes')
    .update({ avatar_path: path, avatar_updated_at: new Date().toISOString(), avatar_origen: 'profesional' })
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)

  if (error) {
    console.error('[pacientes/foto] error actualizando avatar_path')
    return NextResponse.json({ error: 'error_guardado', message: 'No pudimos guardar la foto.' }, { status: 500 })
  }

  await borrarBlobAnterior(paciente.avatar_path, params.id)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const paciente = await pacienteDelTerapeuta(db, params.id, efectivo.terapeutaId)
  if (!paciente) return NextResponse.json({ error: 'no_encontrado' }, { status: 404 })

  if (!paciente.avatar_path) return NextResponse.json({ ok: true })

  const { error } = await db
    .from('pacientes')
    .update({ avatar_path: null, avatar_updated_at: null, avatar_origen: null })
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)

  if (error) {
    console.error('[pacientes/foto] error quitando avatar_path')
    return NextResponse.json({ error: 'error_guardado', message: 'No pudimos quitar la foto.' }, { status: 500 })
  }

  await borrarBlobAnterior(paciente.avatar_path, params.id)

  return NextResponse.json({ ok: true })
}

// Nunca expone la URL del blob — el navegador solo ve esta URL propia,
// autenticada. Fase 1: solo profesional/colaboradora (getEffectiveTerapeutaIdServer).
// El portal del paciente no consume esta ruta todavía.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return new NextResponse(null, { status: 403 })

  const db = serviceClient()
  const { data: paciente } = await db
    .from('pacientes')
    .select('avatar_path')
    .eq('id', params.id)
    .eq('terapeuta_id', efectivo.terapeutaId)
    .maybeSingle()
  if (!paciente?.avatar_path) return new NextResponse(null, { status: 404 })

  const result = await get(paciente.avatar_path, { access: 'private' })
  if (result?.statusCode !== 200) return new NextResponse(null, { status: 404 })

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
