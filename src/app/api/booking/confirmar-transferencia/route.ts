import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { finalizarReservaConfirmada } from '@/lib/booking/finalizar-reserva'
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

  // vence_en: nunca más de 24hs, y nunca después de la hora de la cita — si el turno
  // es en menos de 24hs, no tiene sentido dar una ventana de comprobante más larga que
  // la cita misma. El cron de vencer-turnos-transferencia cancela automáticamente los
  // turnos 'pendiente' que superen este timestamp sin haber sido confirmados a mano.
  const veinticuatroHs = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const fechaCita = parseISO(turno.fecha_hora)
  const venceEn = (fechaCita < veinticuatroHs ? fechaCita : veinticuatroHs).toISOString()

  await db.from('turnos').update({ vence_en: venceEn }).eq('id', turno.id)

  const referencia = hash ?? turno.id

  const { googleEventId, meetLink } = await finalizarReservaConfirmada(turno.id, turno.terapeuta_id, 'transferencia', {
    monto: turno.monto ?? 0,
    moneda: turno.moneda,
    referencia,
  })

  const fechaLocal = toZonedTime(parseISO(turno.fecha_hora), ARGENTINA_TZ)

  return NextResponse.json({
    turno_id: turno.id,
    mp_payment_id: null,
    fecha_fmt: format(fechaLocal, "EEEE d 'de' MMMM yyyy", { locale: es }),
    hora: format(fechaLocal, 'HH:mm'),
    duracion: turno.duracion_min,
    monto: turno.monto ?? 0,
    moneda: turno.moneda,
    referencia,
    medio_pago: 'transferencia' as const,
    google_event_id: googleEventId,
    meet_link: meetLink,
  })
}
