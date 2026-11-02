import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import { estaEnPlazo } from '@/lib/portal/plazo'
import { hoyFechaAR } from '@/lib/tz'
import { diaSemanaKey } from '@/lib/portal/semana'
import { compararComidas } from '@/lib/nutricion/orden-comidas'

export const runtime = 'nodejs'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

type ComidaRow = { id: string; tipo_comida: string; hora: string | null; orden: number }
type RegistroRow = { tipo_comida: string; registrado_at: string; comentario: string | null; foto_vencida: boolean }

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

  const fechaParam = req.nextUrl.searchParams.get('fecha')
  const fecha = fechaParam && FECHA_REGEX.test(fechaParam) ? fechaParam : hoyFechaAR()
  const dia = diaSemanaKey(fecha)

  const [{ data: planesRaw }, { data: acceso }] = await Promise.all([
    db.from('planes_alimentarios').select('id, created_at').eq('paciente_id', principal.pacienteId).eq('terapeuta_id', principal.terapeutaId).neq('estado', 'archivado').order('created_at', { ascending: false }),
    db.from('paciente_accesos').select('registro_habilitado').eq('paciente_id', principal.pacienteId).eq('terapeuta_id', principal.terapeutaId).eq('estado', 'activo').maybeSingle(),
  ])

  const registroHabilitado = acceso?.registro_habilitado ?? true
  const planes = planesRaw ?? []

  if (planes.length === 0) {
    return NextResponse.json({ fecha, noPlan: true, registroHabilitado, filas: [] })
  }

  // Plan vigente de la fecha pedida: el más reciente (no archivado, incluye
  // 'pasado') cuya fecha de creación (civil ART) sea anterior o igual a esa
  // fecha — no necesariamente el plan activo hoy. `planes` ya viene ordenado
  // por created_at desc, así que el primer match es el más reciente.
  const plan = planes.find((p) => hoyFechaAR(new Date(p.created_at)) <= fecha) ?? null
  if (!plan) {
    return NextResponse.json({ fecha, noPlan: false, registroHabilitado, filas: [] })
  }

  const [{ data: comidasRaw }, { data: registrosRaw }] = await Promise.all([
    db.from('plan_comidas').select('id, tipo_comida, hora, orden').eq('plan_id', plan.id).eq('dia_semana', dia),
    db.from('portal_registros').select('tipo_comida, registrado_at, comentario, foto_vencida').eq('paciente_id', principal.pacienteId).eq('terapeuta_id', principal.terapeutaId).eq('fecha_local', fecha),
  ])

  const comidas = ((comidasRaw ?? []) as ComidaRow[]).sort(compararComidas)
  const registroPorTipo = new Map<string, RegistroRow>()
  for (const r of (registrosRaw ?? []) as RegistroRow[]) registroPorTipo.set(r.tipo_comida, r)

  const ahora = new Date()
  const filas = comidas.map((c) => {
    const registro = registroPorTipo.get(c.tipo_comida) ?? null
    const estado: 'registrada' | 'pendiente' | 'vencida' = registro
      ? 'registrada'
      : estaEnPlazo(fecha, c.hora, ahora) ? 'pendiente' : 'vencida'

    return {
      tipoComida: c.tipo_comida,
      hora: c.hora,
      estado,
      registro: registro ? { registradoAt: registro.registrado_at, comentario: registro.comentario, fotoVencida: registro.foto_vencida } : null,
    }
  })

  return NextResponse.json({ fecha, noPlan: false, registroHabilitado, filas })
}
