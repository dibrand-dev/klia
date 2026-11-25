import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { consultarPractitioner, BusConsultaError } from '@/lib/refeps/bus'
import type { MatriculaResultado } from '@/types/sisa'

export const runtime = 'nodejs'

export async function POST(): Promise<NextResponse> {
  // Auth — solo el propio profesional autenticado consulta su matrícula.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // DNI del propio perfil autenticado — nunca un DNI libre del body.
  const db = serviceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('dni, matricula')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.dni) {
    return NextResponse.json({ error: 'Falta cargar el DNI en tu perfil' }, { status: 400 })
  }

  const fechaVerificacion = new Date().toISOString()

  try {
    const resultado = await consultarPractitioner(profile.dni)

    if (resultado.estado === 'sin_ficha') {
      const body: MatriculaResultado = {
        estado: 'sin_ficha',
        fechaVerificacion,
        qualifications: [],
        coincideMatricula: null,
      }
      return NextResponse.json(body, { status: 200 })
    }

    const matriculaPropia = profile.matricula?.trim() || null
    const coincideMatricula = matriculaPropia
      ? resultado.qualifications.some((q) => q.numero?.trim() === matriculaPropia)
      : null

    const body: MatriculaResultado = {
      estado: resultado.estado,
      fechaVerificacion,
      qualifications: resultado.qualifications,
      coincideMatricula,
    }
    return NextResponse.json(body, { status: 200 })
  } catch (err) {
    // Un error del Bus (403/500/timeout/red) nunca marca al profesional
    // como no habilitado — queda en "error_servicio" para reintentar.
    const codigo = err instanceof BusConsultaError ? err.codigo : 'bus_no_disponible'
    console.error('[REFEPS] Error al consultar el Bus de Interoperabilidad:', codigo)
    const body: MatriculaResultado = {
      estado: 'error_servicio',
      fechaVerificacion,
      qualifications: [],
      coincideMatricula: null,
    }
    return NextResponse.json(body, { status: 200 })
  }
}
