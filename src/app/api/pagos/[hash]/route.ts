import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { hash: string } }
) {
  const db = serviceClient()

  const { data: sesion } = await db
    .from('sesiones_pago')
    .select('*')
    .eq('hash', params.hash)
    .single()

  if (!sesion) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const { data: turno } = await db
    .from('turnos')
    .select('fecha_hora, duracion_min, modalidad')
    .eq('id', sesion.turno_id)
    .single()

  const { data: profRaw } = await db
    .from('profiles')
    .select('nombre, apellido, especialidad, avatar_url, matricula')
    .eq('id', sesion.terapeuta_id)
    .single()

  const { data: pacienteRaw } = await db
    .from('pacientes')
    .select('nombre, apellido')
    .eq('id', sesion.paciente_id)
    .single()

  return NextResponse.json({
    hash: sesion.hash,
    estado: sesion.estado,
    monto: sesion.monto,
    moneda: sesion.moneda,
    vence_at: sesion.vence_at,
    mp_preference_id: sesion.mp_preference_id,
    turno: turno ? {
      fecha_hora: turno.fecha_hora,
      duracion_min: turno.duracion_min,
      modalidad: turno.modalidad,
    } : null,
    profesional: profRaw ? {
      nombre: profRaw.nombre,
      apellido: profRaw.apellido,
      especialidad: profRaw.especialidad,
      avatar_url: profRaw.avatar_url,
      matricula: profRaw.matricula,
    } : null,
    paciente: pacienteRaw ? {
      nombre: pacienteRaw.nombre,
      apellido: pacienteRaw.apellido,
    } : null,
  })
}
