import { NextRequest, NextResponse } from 'next/server'
import { getFeriados, getFeriadosProvinciales } from '@/lib/feriados'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const anio = parseInt(searchParams.get('anio') ?? new Date().getFullYear().toString())
  const provincia = searchParams.get('provincia') || null

  const [nacionales, provinciales] = await Promise.all([
    getFeriados(anio),
    provincia ? getFeriadosProvinciales(anio, provincia) : Promise.resolve([]),
  ])

  const todos = [...nacionales]
  for (const p of provinciales) {
    const existe = todos.find(n => n.dia === p.dia && n.mes === p.mes)
    if (!existe) todos.push({ ...p, provincia: provincia ?? undefined })
  }

  return NextResponse.json({ feriados: todos })
}
