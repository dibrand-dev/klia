import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { guardarAvatarPaciente, quitarAvatarPaciente, leerAvatarBlob } from '@/lib/pacientes/avatar'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'form_invalido', message: 'No pudimos leer la solicitud.' }, { status: 400 })

  const fotoFile = form.get('foto')
  if (!(fotoFile instanceof File)) {
    return NextResponse.json({ error: 'falta_archivo', message: 'Falta la foto.' }, { status: 400 })
  }

  const resultado = await guardarAvatarPaciente(serviceClient(), {
    pacienteId: params.id,
    terapeutaId: efectivo.terapeutaId,
    origen: 'profesional',
    fotoFile,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, message: resultado.message }, { status: resultado.status })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const resultado = await quitarAvatarPaciente(serviceClient(), {
    pacienteId: params.id,
    terapeutaId: efectivo.terapeutaId,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error, message: resultado.message }, { status: resultado.status })
  }
  return NextResponse.json({ ok: true })
}

// Nunca expone la URL del blob — el navegador solo ve esta URL propia,
// autenticada. Fase 1: solo profesional/colaboradora (getEffectiveTerapeutaIdServer).
// El portal del paciente tiene su propio endpoint (/api/portal/foto, Fase 2).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return new NextResponse(null, { status: 403 })

  const result = await leerAvatarBlob(serviceClient(), {
    pacienteId: params.id,
    terapeutaId: efectivo.terapeutaId,
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
