import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import { guardarAvatarPaciente, quitarAvatarPaciente, leerAvatarBlob } from '@/lib/pacientes/avatar'

export const runtime = 'nodejs'
export const maxDuration = 15

// Foto de perfil del portal — misma foto que ve la ficha (pacientes.avatar_path,
// compartido, gana la última que se guardó). Nunca opera sobre un paciente_id
// que venga del cliente: siempre accesoPrincipal(user.id), que ya filtra por
// acceso 'activo' Y portal habilitado ahora mismo para ese profesional
// (revocado/plan no habilitado → null → 403). A propósito NO chequea
// paciente_accesos.registro_habilitado: ese flag pausa el registro de
// comidas, no la foto de perfil.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'form_invalido', message: 'No pudimos leer la solicitud.' }, { status: 400 })

  const fotoFile = form.get('foto')
  if (!(fotoFile instanceof File)) {
    return NextResponse.json({ error: 'falta_archivo', message: 'Falta la foto.' }, { status: 400 })
  }

  const resultado = await guardarAvatarPaciente(db, {
    pacienteId: principal.pacienteId,
    terapeutaId: principal.terapeutaId,
    origen: 'paciente',
    fotoFile,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, message: resultado.message }, { status: resultado.status })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

  const resultado = await quitarAvatarPaciente(db, {
    pacienteId: principal.pacienteId,
    terapeutaId: principal.terapeutaId,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, message: resultado.message }, { status: resultado.status })
  }
  return NextResponse.json({ ok: true })
}

// Nunca expone la URL del blob. ?v= es solo cache-buster del cliente, el
// server lo ignora. Solo el paciente dueño puede leer su propia foto (nunca
// un id ajeno: no hay id en la URL, siempre accesoPrincipal del propio user).
export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return new NextResponse(null, { status: 403 })

  const result = await leerAvatarBlob(db, {
    pacienteId: principal.pacienteId,
    terapeutaId: principal.terapeutaId,
  })
  if (!result) return new NextResponse(null, { status: 404 })

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
