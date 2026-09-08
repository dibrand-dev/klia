import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { sincronizarTurnoCreado } from '@/lib/sync-google-calendar'
import { ARGENTINA_TZ } from '@/lib/timezone'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { turno_id?: string; hash?: string }
  const { turno_id: turnoId, hash } = body

  if (!turnoId) {
    return NextResponse.json({ error: 'turno_id requerido' }, { status: 400 })
  }

  const db = serviceClient()

  const { data: turno } = await db
    .from('turnos')
    .select('id, terapeuta_id, fecha_hora, duracion_min, monto, moneda, estado')
    .eq('id', turnoId)
    .single()

  if (!turno) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  if (turno.estado === 'cancelado') {
    return NextResponse.json({ error: 'El turno fue cancelado' }, { status: 409 })
  }

  // El turno queda 'pendiente' (ya lo está desde su creación) — solo un pago real
  // por Mercado Pago confirma automáticamente. La transferencia espera confirmación
  // manual del profesional en Agenda.

  try {
    await sincronizarTurnoCreado(turno.id, turno.terapeuta_id)
  } catch (err) {
    console.error('🔴 GCAL SYNC FAILED:', err instanceof Error ? err.message : err)
    // non-critical — GCal sync failure must not break booking
  }

  const fechaLocal = toZonedTime(parseISO(turno.fecha_hora), ARGENTINA_TZ)

  return NextResponse.json({
    turno_id: turno.id,
    mp_payment_id: null,
    fecha_fmt: format(fechaLocal, "EEEE d 'de' MMMM yyyy", { locale: es }),
    hora: format(fechaLocal, 'HH:mm'),
    duracion: turno.duracion_min,
    monto: turno.monto ?? 0,
    moneda: turno.moneda,
    referencia: hash ?? turno.id,
    medio_pago: 'transferencia' as const,
  })
}
