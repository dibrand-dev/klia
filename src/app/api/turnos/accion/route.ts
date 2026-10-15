import { NextRequest, NextResponse } from 'next/server'
import { aplicarAccionTurno } from '@/lib/turnos-accion'

export async function POST(req: NextRequest) {
  const body = await req.json() as { token?: string; accion?: string }

  const resultado = await aplicarAccionTurno(body.token, body.accion)

  if (!resultado.ok) {
    return NextResponse.json(resultado.body, { status: resultado.status })
  }

  return NextResponse.json({ ok: true, estado: resultado.estado, pagado: resultado.pagado, tardia: resultado.tardia })
}
