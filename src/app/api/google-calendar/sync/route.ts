import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sincronizarTurnoCreado,
  sincronizarTurnoCancelado,
  sincronizarSerieRecurrente,
  sincronizarSerieRecurrentePorIds,
  sincronizarSerieCancelada,
  sincronizarSerieCanceladaPorIds,
  sincronizarEntrevistaCreada,
  sincronizarEntrevistaCancelada,
  sincronizarTurnoActualizado,
  sincronizarEntrevistaActualizada,
} from '@/lib/sync-google-calendar'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as {
    turno_id?: string
    serie_id?: string
    desde_fecha?: string
    entrevista_id?: string
    turno_ids?: string[]
    google_event_ids?: string[]
    action: 'create' | 'update' | 'delete'
  }

  try {
    if (body.action === 'create') {
      if (body.turno_ids) {
        await sincronizarSerieRecurrentePorIds(body.turno_ids, user.id)
      } else if (body.serie_id) {
        await sincronizarSerieRecurrente(body.serie_id, user.id)
      } else if (body.turno_id) {
        await sincronizarTurnoCreado(body.turno_id, user.id)
      } else if (body.entrevista_id) {
        await sincronizarEntrevistaCreada(body.entrevista_id, user.id)
      }
    } else if (body.action === 'update') {
      if (body.turno_id) {
        await sincronizarTurnoActualizado(body.turno_id, user.id)
      } else if (body.entrevista_id) {
        await sincronizarEntrevistaActualizada(body.entrevista_id, user.id)
      }
    } else if (body.action === 'delete') {
      if (body.google_event_ids) {
        await sincronizarSerieCanceladaPorIds(body.google_event_ids, user.id)
      } else if (body.serie_id && body.desde_fecha) {
        await sincronizarSerieCancelada(body.serie_id, user.id, body.desde_fecha)
      } else if (body.turno_id) {
        await sincronizarTurnoCancelado(body.turno_id, user.id)
      } else if (body.entrevista_id) {
        await sincronizarEntrevistaCancelada(body.entrevista_id, user.id)
      }
    }
  } catch (err) {
    // Sync errors son no-fatales para el request (los datos ya están en DB),
    // pero necesitamos rastro en los logs de Vercel — antes se descartaban
    // en silencio y no había forma de diagnosticar sync fallidos a GCal.
    console.error('[google-calendar/sync] Error procesando sync:', { action: body.action, body }, err)
  }

  return NextResponse.json({ ok: true })
}
