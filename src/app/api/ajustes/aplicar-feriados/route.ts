import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getFeriados, getFeriadosProvinciales, esFeriado } from '@/lib/feriados'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await db
    .from('profiles')
    .select('id, feriados_nacionales, feriados_provinciales, feriados_trabajar_si_confirmado, provincia')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const anio = new Date().getFullYear()
  const [nacionales, provinciales] = await Promise.all([
    profile.feriados_nacionales ? getFeriados(anio) : Promise.resolve([]),
    profile.feriados_provinciales && profile.provincia
      ? getFeriadosProvinciales(anio, profile.provincia)
      : Promise.resolve([]),
  ])
  const todosFeriados = [...nacionales, ...provinciales]

  if (todosFeriados.length === 0) return NextResponse.json({ actualizados: 0 })

  const estadosExcluir: string[] = ['cancelado']
  if (profile.feriados_trabajar_si_confirmado) estadosExcluir.push('confirmado')

  const { data: turnos } = await db
    .from('turnos')
    .select('id, fecha_hora, monto')
    .eq('terapeuta_id', user.id)
    .gt('fecha_hora', new Date().toISOString())
    .not('estado', 'in', `(${estadosExcluir.map(e => `"${e}"`).join(',')})`)

  let actualizados = 0
  for (const turno of turnos ?? []) {
    const fecha = new Date(turno.fecha_hora)
    if (esFeriado(fecha, todosFeriados)) {
      await db
        .from('turnos')
        .update({ estado_pago: 'bonificado', monto_pagado: turno.monto ?? 0 })
        .eq('id', turno.id)
      actualizados++
    }
  }

  return NextResponse.json({ actualizados })
}
