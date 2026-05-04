import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sincronizarTurnoCreado,
  sincronizarTurnoCancelado,
  sincronizarSerieRecurrente,
  sincronizarSerieCancelada,
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
    action: 'create' | 'update' | 'delete'
  }

  try {
    if (body.action === 'create') {
      if (body.serie_id) {
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
      if (body.serie_id && body.desde_fecha) {
        await sincronizarSerieCancelada(body.serie_id, user.id, body.desde_fecha)
      } else if (body.turno_id) {
        await sincronizarTurnoCancelado(body.turno_id, user.id)
      } else if (body.entrevista_id) {
        await sincronizarEntrevistaCancelada(body.entrevista_id, user.id)
      }
    }
  } catch {
    // Sync errors are non-fatal — turn data is already in DB
  }

  return NextResponse.json({ ok: true })
}
