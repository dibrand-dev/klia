import type { SupabaseClient } from '@supabase/supabase-js'
import { fromZonedTime } from 'date-fns-tz'
import { ARGENTINA_TZ, zonedDateArgentina } from '@/lib/timezone'

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Mismo chequeo en dos momentos del flujo de reserva pública: al crear la
// reserva (antes del pago) y al aprobarse el pago (crearReservaDesdePago) —
// puede haber pasado tiempo entre uno y otro, así que siempre se re-chequea
// antes de crear el turno real.
export async function isSlotAvailable(
  db: SupabaseClient,
  profileId: string,
  fecha: string,
  hora: string,
  duracion: number,
): Promise<boolean> {
  const slotStart = timeToMin(hora)
  const slotEnd = slotStart + duracion

  const dayStart = fromZonedTime(`${fecha}T00:00:00`, ARGENTINA_TZ).toISOString()
  const dayEnd = fromZonedTime(`${fecha}T23:59:59`, ARGENTINA_TZ).toISOString()

  const [{ data: turnos }, { data: entrevistas }] = await Promise.all([
    db.from('turnos')
      .select('fecha_hora, duracion_min')
      .eq('terapeuta_id', profileId)
      .gte('fecha_hora', dayStart)
      .lte('fecha_hora', dayEnd)
      .not('estado', 'in', '("cancelado")'),
    db.from('entrevistas')
      .select('hora, duracion')
      .eq('terapeuta_id', profileId)
      .eq('fecha', fecha)
      .not('estado', 'in', '("cancelada")'),
  ])

  for (const t of turnos ?? []) {
    const d = zonedDateArgentina(t.fecha_hora)
    const oStart = d.getHours() * 60 + d.getMinutes()
    const oEnd = oStart + (t.duracion_min ?? duracion)
    if (slotStart < oEnd && slotEnd > oStart) return false
  }

  for (const e of entrevistas ?? []) {
    const oStart = timeToMin(e.hora)
    const oEnd = oStart + (e.duracion ?? 30)
    if (slotStart < oEnd && slotEnd > oStart) return false
  }

  return true
}
