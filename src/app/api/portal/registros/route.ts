import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import { estaEnPlazo, estaEnPlazoLibre } from '@/lib/portal/plazo'
import { planVigentePorFecha } from '@/lib/portal/plan-vigente'
import { diaSemanaKey } from '@/lib/portal/semana'
import { hoyFechaAR } from '@/lib/tz'
import { tipoImagenReal } from '@/lib/portal/magic-bytes'
import { COMIDA_LIBRE_MULTIPLE, esComidaLibre } from '@/lib/portal/comidas-libres'

export const runtime = 'nodejs'
export const maxDuration = 30

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_FOTO_BYTES = 1_500_000
const MAX_THUMB_BYTES = 100_000

type RegistroExistente = { id: string; foto_path: string | null; foto_thumb_path: string | null }

function contentTypeDe(ext: 'webp' | 'jpeg'): string {
  return ext === 'webp' ? 'image/webp' : 'image/jpeg'
}

// Best-effort: nunca interrumpe la respuesta al paciente por un blob viejo
// que no se pudo borrar — se loguea sin el pathname (puede filtrar datos del
// paciente/profesional en la ruta) y sin más detalle del error.
async function borrarBlobsAnteriores(paths: (string | null)[], registroId: string) {
  const validos = paths.filter((p): p is string => !!p)
  if (validos.length === 0) return
  try {
    await del(validos)
  } catch {
    console.error(`[portal/registros] no se pudieron borrar blobs anteriores del registro ${registroId}`)
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

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

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'form_invalido', message: 'No pudimos leer la solicitud.' }, { status: 400 })

  const fotoFile = form.get('foto')
  const miniaturaFile = form.get('miniatura')
  const fecha = String(form.get('fecha') ?? '')
  const planComidaId = String(form.get('comida') ?? '') || null
  const tipoComidaLibreForm = String(form.get('tipo_comida') ?? '') || null
  const comentario = String(form.get('comentario') ?? '').trim().slice(0, 300) || null

  if (!(fotoFile instanceof File) || !(miniaturaFile instanceof File)) {
    return NextResponse.json({ error: 'falta_archivo', message: 'Falta la foto o la miniatura.' }, { status: 400 })
  }
  if (!FECHA_REGEX.test(fecha) || (!planComidaId && !tipoComidaLibreForm)) {
    return NextResponse.json({ error: 'datos_invalidos', message: 'Faltan datos de la comida.' }, { status: 400 })
  }
  if (fotoFile.size > MAX_FOTO_BYTES || miniaturaFile.size > MAX_THUMB_BYTES) {
    return NextResponse.json({ error: 'archivo_muy_grande', message: 'La foto es demasiado grande.' }, { status: 413 })
  }

  const hoy = hoyFechaAR()
  if (fecha > hoy) {
    return NextResponse.json({ error: 'fecha_futura', message: 'No se puede registrar una fecha futura.' }, { status: 400 })
  }

  const fotoBuf = Buffer.from(await fotoFile.arrayBuffer())
  const miniaturaBuf = Buffer.from(await miniaturaFile.arrayBuffer())
  const tipoFoto = tipoImagenReal(fotoBuf)
  const tipoThumb = tipoImagenReal(miniaturaBuf)
  if (!tipoFoto || !tipoThumb) {
    return NextResponse.json({ error: 'tipo_invalido', message: 'El archivo no es una imagen válida.' }, { status: 400 })
  }

  // El modo (plan vs. libre) nunca se confía al cliente — se recalcula acá
  // igual que en GET /api/portal/hoy: con plan vigente y comidas cargadas
  // ESE día, se exige `comida` (plan_comida_id); si no, es modo libre y se
  // exige `tipo_comida` de la lista fija.
  const plan = await planVigentePorFecha(db, principal.pacienteId, principal.terapeutaId, fecha)
  const dia = diaSemanaKey(fecha)
  const { data: comidasDelDiaRaw } = plan
    ? await db.from('plan_comidas').select('id').eq('plan_id', plan.id).eq('dia_semana', dia)
    : { data: [] as { id: string }[] }
  const modoLibre = !plan || (comidasDelDiaRaw ?? []).length === 0

  let tipoComida: string
  let planComidaIdFinal: string | null = null

  if (!modoLibre) {
    if (!planComidaId) {
      return NextResponse.json({ error: 'datos_invalidos', message: 'Esta fecha tiene plan alimentario — elegí una comida del plan.' }, { status: 400 })
    }
    const { data: comida } = await db
      .from('plan_comidas')
      .select('id, hora, tipo_comida')
      .eq('id', planComidaId)
      .eq('plan_id', plan!.id)
      .eq('dia_semana', dia)
      .maybeSingle()
    if (!comida) {
      return NextResponse.json({ error: 'comida_no_coincide', message: 'Esta comida ya no está en el plan vigente de esa fecha.' }, { status: 400 })
    }
    if (!estaEnPlazo(fecha, comida.hora, new Date())) {
      return NextResponse.json({ error: 'fuera_de_plazo', message: 'Ya pasaron más de 48 h desde esta comida.' }, { status: 403 })
    }
    tipoComida = comida.tipo_comida
    planComidaIdFinal = comida.id
  } else {
    if (!tipoComidaLibreForm || !esComidaLibre(tipoComidaLibreForm)) {
      return NextResponse.json({ error: 'tipo_comida_invalido', message: 'Elegí una comida válida.' }, { status: 400 })
    }
    if (!estaEnPlazoLibre(fecha, new Date())) {
      return NextResponse.json({ error: 'fuera_de_plazo', message: 'Ya pasó el plazo para registrar esta fecha.' }, { status: 403 })
    }
    tipoComida = tipoComidaLibreForm
  }

  const esColacionLibre = modoLibre && tipoComida === COMIDA_LIBRE_MULTIPLE

  // Busca un registro existente para reemplazar — mismo criterio que el
  // índice único real de cada caso: (paciente, fecha, plan_comida_id) en
  // modo plan; (paciente, fecha, tipo_comida) con plan_comida_id null en
  // modo libre no-Colación (portal_registros_slot_libre_uq). Colación nunca
  // busca: cada foto es un registro nuevo, puede haber varias por día.
  let existente: RegistroExistente | null = null
  if (!esColacionLibre) {
    let q = db.from('portal_registros').select('id, foto_path, foto_thumb_path')
      .eq('paciente_id', principal.pacienteId)
      .eq('fecha_local', fecha)
    q = modoLibre ? q.is('plan_comida_id', null).eq('tipo_comida', tipoComida) : q.eq('plan_comida_id', planComidaIdFinal)
    const { data: existenteRaw } = await q.maybeSingle()
    existente = existenteRaw as RegistroExistente | null
  }

  // Pathname versionado (timestamp): cada subida —incluso un reemplazo del
  // mismo registro— queda en un blob nuevo, así el cliente puede romper el
  // cache del navegador con ?t={fotoVersion} sin depender de invalidaciones.
  const registroId = existente?.id ?? randomUUID()
  const version = Date.now()
  const base = `portal/${principal.terapeutaId}/${principal.pacienteId}/${fecha}`
  const fotoPath = `${base}/${registroId}-${version}.${tipoFoto}`
  const thumbPath = `${base}/${registroId}-${version}-thumb.${tipoThumb}`

  await put(fotoPath, fotoBuf, { access: 'private', contentType: contentTypeDe(tipoFoto), addRandomSuffix: false, allowOverwrite: true })
  await put(thumbPath, miniaturaBuf, { access: 'private', contentType: contentTypeDe(tipoThumb), addRandomSuffix: false, allowOverwrite: true })

  const filaBase = {
    paciente_id: principal.pacienteId,
    terapeuta_id: principal.terapeutaId,
    plan_comida_id: planComidaIdFinal,
    tipo_comida: tipoComida,
    fecha_local: fecha,
    registrado_at: new Date().toISOString(),
    foto_path: fotoPath,
    foto_thumb_path: thumbPath,
    foto_bytes: fotoBuf.byteLength,
    foto_vencida: false,
    comentario,
    updated_at: new Date().toISOString(),
  }

  if (existente) {
    const { error } = await db.from('portal_registros').update(filaBase).eq('id', existente.id)
    if (error) {
      console.error('[portal/registros] error actualizando registro')
      return NextResponse.json({ error: 'error_guardado', message: 'No pudimos guardar el registro.' }, { status: 500 })
    }
  } else {
    const { error } = await db.from('portal_registros').insert({ id: registroId, ...filaBase })
    if (error?.code === '23505' && !esColacionLibre) {
      // Carrera: otro request insertó primero el mismo slot (mismo
      // paciente+fecha+comida, o paciente+fecha+tipo_comida libre). Nos
      // "convertimos" en un reemplazo de ESA fila — nunca creamos dos
      // registros para el mismo slot. Colación nunca puede chocar: cada
      // insert es un registro nuevo e independiente.
      let qGanador = db.from('portal_registros').select('id, foto_path, foto_thumb_path')
        .eq('paciente_id', principal.pacienteId)
        .eq('fecha_local', fecha)
      qGanador = modoLibre ? qGanador.is('plan_comida_id', null).eq('tipo_comida', tipoComida) : qGanador.eq('plan_comida_id', planComidaIdFinal)
      const { data: ganador } = await qGanador.maybeSingle()
      if (!ganador) {
        console.error('[portal/registros] conflicto de unicidad sin fila ganadora')
        return NextResponse.json({ error: 'error_guardado', message: 'No pudimos guardar el registro.' }, { status: 500 })
      }
      const { error: errorUpdate } = await db.from('portal_registros').update(filaBase).eq('id', ganador.id)
      if (errorUpdate) {
        console.error('[portal/registros] error actualizando tras conflicto de unicidad')
        return NextResponse.json({ error: 'error_guardado', message: 'No pudimos guardar el registro.' }, { status: 500 })
      }
      existente = ganador as RegistroExistente
    } else if (error) {
      console.error('[portal/registros] error insertando registro')
      return NextResponse.json({ error: 'error_guardado', message: 'No pudimos guardar el registro.' }, { status: 500 })
    }
  }

  if (existente) {
    await borrarBlobsAnteriores([existente.foto_path, existente.foto_thumb_path], existente.id)
  }

  return NextResponse.json({ ok: true, id: existente?.id ?? registroId })
}
