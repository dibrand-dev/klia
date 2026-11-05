import { put, del, get, type GetBlobResult } from '@vercel/blob'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { tipoImagenReal } from '@/lib/portal/magic-bytes'

// Lógica de la foto de paciente (una sola por paciente, compartida entre
// ficha y portal — gana la última que se guardó) compartida entre
// /api/pacientes/[id]/foto (profesional/colaboradora) y /api/portal/foto
// (paciente). Cada caller resuelve su propia auth y le pasa el par
// (pacienteId, terapeutaId) ya validado — nunca un id que venga sin
// verificar del cliente. El filtro .eq('id',...).eq('terapeuta_id',...) de
// cada query es, en los dos casos, el control de pertenencia real.

const MAX_FOTO_BYTES = 1024 * 1024

type DB = SupabaseClient<Database>

export type ResultadoAvatar =
  | { ok: true }
  | { ok: false; error: string; message: string; status: number }

async function filaAvatar(db: DB, pacienteId: string, terapeutaId: string) {
  const { data } = await db
    .from('pacientes')
    .select('avatar_path')
    .eq('id', pacienteId)
    .eq('terapeuta_id', terapeutaId)
    .maybeSingle()
  return data ?? null
}

// Best-effort: nunca interrumpe la respuesta por un blob viejo que no se
// pudo borrar — se loguea sin el pathname (puede filtrar datos del paciente).
async function borrarBlobAnterior(path: string | null, pacienteId: string) {
  if (!path) return
  try {
    await del(path)
  } catch {
    console.error(`[avatar] no se pudo borrar el blob anterior del paciente ${pacienteId}`)
  }
}

export async function guardarAvatarPaciente(
  db: DB,
  params: { pacienteId: string; terapeutaId: string; origen: 'profesional' | 'paciente'; fotoFile: File },
): Promise<ResultadoAvatar> {
  const { pacienteId, terapeutaId, origen, fotoFile } = params
  const paciente = await filaAvatar(db, pacienteId, terapeutaId)
  if (!paciente) return { ok: false, error: 'no_encontrado', message: 'Paciente no encontrado.', status: 404 }

  if (fotoFile.size > MAX_FOTO_BYTES) {
    return { ok: false, error: 'archivo_muy_grande', message: 'La foto es demasiado grande.', status: 413 }
  }

  const fotoBuf = Buffer.from(await fotoFile.arrayBuffer())
  if (tipoImagenReal(fotoBuf) !== 'jpeg') {
    return { ok: false, error: 'tipo_invalido', message: 'El archivo no es una imagen válida.', status: 400 }
  }

  const path = `pacientes-avatar/${pacienteId}/${Date.now()}.jpg`
  await put(path, fotoBuf, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true })

  const { error } = await db
    .from('pacientes')
    .update({ avatar_path: path, avatar_updated_at: new Date().toISOString(), avatar_origen: origen })
    .eq('id', pacienteId)
    .eq('terapeuta_id', terapeutaId)

  if (error) {
    console.error('[avatar] error actualizando avatar_path')
    return { ok: false, error: 'error_guardado', message: 'No pudimos guardar la foto.', status: 500 }
  }

  await borrarBlobAnterior(paciente.avatar_path, pacienteId)
  return { ok: true }
}

export async function quitarAvatarPaciente(
  db: DB,
  params: { pacienteId: string; terapeutaId: string },
): Promise<ResultadoAvatar> {
  const { pacienteId, terapeutaId } = params
  const paciente = await filaAvatar(db, pacienteId, terapeutaId)
  if (!paciente) return { ok: false, error: 'no_encontrado', message: 'Paciente no encontrado.', status: 404 }
  if (!paciente.avatar_path) return { ok: true }

  const { error } = await db
    .from('pacientes')
    .update({ avatar_path: null, avatar_updated_at: null, avatar_origen: null })
    .eq('id', pacienteId)
    .eq('terapeuta_id', terapeutaId)

  if (error) {
    console.error('[avatar] error quitando avatar_path')
    return { ok: false, error: 'error_guardado', message: 'No pudimos quitar la foto.', status: 500 }
  }

  await borrarBlobAnterior(paciente.avatar_path, pacienteId)
  return { ok: true }
}

// Nunca expone la URL del blob — el caller re-transmite result.stream con su
// propio Content-Type/Cache-Control. Devuelve null si no hay foto o el
// paciente no pertenece a ese terapeuta (ambos casos → 404 en el caller).
// Tipo acotado a la rama 200 de GetBlobResult (stream+contentType siempre
// presentes) — el 304 no aplica acá porque get() nunca recibe condicionales.
export async function leerAvatarBlob(
  db: DB,
  params: { pacienteId: string; terapeutaId: string },
): Promise<Extract<GetBlobResult, { statusCode: 200 }> | null> {
  const paciente = await filaAvatar(db, params.pacienteId, params.terapeutaId)
  if (!paciente?.avatar_path) return null
  const result = await get(paciente.avatar_path, { access: 'private' })
  if (result?.statusCode !== 200) return null
  return result
}
