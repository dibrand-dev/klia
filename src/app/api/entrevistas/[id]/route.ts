import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    action: 'update_estado' | 'convertir'
    estado?: string
  }

  if (body.action === 'update_estado') {
    const { error } = await supabase
      .from('entrevistas')
      .update({ estado: body.estado, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('terapeuta_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'convertir') {
    const { data: entrevista } = await supabase
      .from('entrevistas')
      .select('*')
      .eq('id', params.id)
      .eq('terapeuta_id', user.id)
      .single()

    if (!entrevista) return NextResponse.json({ error: 'Entrevista no encontrada' }, { status: 404 })
    if (entrevista.estado === 'convertida') return NextResponse.json({ error: 'Ya fue convertida' }, { status: 400 })

    const { data: paciente, error: pacienteError } = await supabase
      .from('pacientes')
      .insert({
        terapeuta_id: user.id,
        nombre: entrevista.nombre,
        apellido: entrevista.apellido,
        telefono: entrevista.telefono,
        email: entrevista.email,
        activo: true,
      })
      .select('id')
      .single()

    if (pacienteError || !paciente) {
      return NextResponse.json({ error: `Error al crear paciente: ${pacienteError?.message}` }, { status: 500 })
    }

    const fechaHora = `${entrevista.fecha}T${entrevista.hora}`
    const hasCosto = entrevista.costo != null && entrevista.costo > 0

    const { data: turno, error: turnoError } = await supabase
      .from('turnos')
      .insert({
        terapeuta_id: user.id,
        paciente_id: paciente.id,
        fecha_hora: fechaHora,
        duracion_min: entrevista.duracion,
        modalidad: 'presencial',
        estado: 'realizado',
        monto: entrevista.costo ?? null,
        moneda: entrevista.moneda ?? 'ARS',
        pagado: hasCosto,
        estado_pago: hasCosto ? 'pagado' : 'pendiente',
        monto_pagado: hasCosto ? entrevista.costo : null,
        notas: 'Entrevista inicial',
      })
      .select('id')
      .single()

    const turnoOverlap = turnoError?.message?.includes('TURNO_OVERLAP')

    if (turnoError && !turnoOverlap) {
      return NextResponse.json({ error: `Error al crear sesión: ${turnoError.message}` }, { status: 500 })
    }

    if (turno && hasCosto) {
      await supabase.from('cobros').insert({
        turno_id: turno.id,
        terapeuta_id: user.id,
        paciente_id: paciente.id,
        monto_cobrado: entrevista.costo!,
        moneda: entrevista.moneda ?? 'ARS',
        medio_pago: null,
        fecha_cobro: entrevista.fecha,
        notas: 'Entrevista inicial',
      })
    }

    await supabase
      .from('entrevistas')
      .update({ estado: 'convertida', paciente_id: paciente.id, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ ok: true, paciente_id: paciente.id })
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
}
