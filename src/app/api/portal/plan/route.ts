import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { accesoPrincipal } from '@/lib/portal/acceso'
import { obtenerDatosPlanAlimentario } from '@/lib/nutricion/plan-datos-completos'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const principal = await accesoPrincipal(db, user.id)
  if (!principal) return NextResponse.json({ error: 'portal_no_habilitado' }, { status: 403 })

  const { data: plan } = await db
    .from('planes_alimentarios')
    .select('id, mostrar_macros_paciente')
    .eq('paciente_id', principal.pacienteId)
    .eq('terapeuta_id', principal.terapeutaId)
    .eq('estado', 'activo')
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ noPlan: true })
  }

  const datos = await obtenerDatosPlanAlimentario(db, plan.id, principal.terapeutaId)
  if (!datos) {
    return NextResponse.json({ noPlan: true })
  }

  return NextResponse.json({
    noPlan: false,
    profesionalNombreCorto: datos.profesionalNombreCorto,
    objetivoTitulo: datos.objetivoTitulo,
    objetivoNota: datos.objetivoNota,
    kcalObjetivo: datos.kcalObjetivo,
    porcentajeCarbohidratos: datos.porcentajeCarbohidratos,
    porcentajeProteinas: datos.porcentajeProteinas,
    porcentajeGrasas: datos.porcentajeGrasas,
    indicaciones: datos.indicaciones,
    fechaPreparacion: datos.fechaPreparacion,
    comidas: datos.comidas,
    kcalPorDia: datos.kcalPorDia,
    mostrarMacros: plan.mostrar_macros_paciente,
  })
}
