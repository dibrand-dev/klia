import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { verificarCron } from '@/lib/cron-auth'
import { serviceClient } from '@/lib/supabase/service'
import { diasRetencionPorPlan } from '@/lib/portal/retencion'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const LOTE = 500
const MAX_ITERACIONES = 50

// Único lugar que borra blobs y pone foto_vencida=true — las rutas de
// lectura (hoy, registros del profesional, fotos) ya calculan "vencida en
// vivo" aparte (src/lib/portal/retencion.ts: fotoVencida()) para no
// depender de que este cron haya corrido hoy, pero el borrado real de los
// blobs y el null de las columnas de foto son responsabilidad exclusiva de
// esta corrida.
export async function GET(req: NextRequest) {
  if (!verificarCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const diasCache = new Map<string, number | null>()
  const planCache = new Map<string, string | null>()
  const omitidos = new Set<string>()

  async function diasPara(terapeutaId: string): Promise<number | null> {
    if (diasCache.has(terapeutaId)) return diasCache.get(terapeutaId)!
    let plan: string | null
    if (planCache.has(terapeutaId)) {
      plan = planCache.get(terapeutaId)!
    } else {
      const { data } = await db.from('profiles').select('plan').eq('id', terapeutaId).maybeSingle()
      plan = data?.plan ?? null
      planCache.set(terapeutaId, plan)
    }
    const dias = await diasRetencionPorPlan(db, plan)
    diasCache.set(terapeutaId, dias)
    return dias
  }

  let totalBorrados = 0
  let iteraciones = 0

  while (iteraciones++ < MAX_ITERACIONES) {
    const { data: candidatos } = await db
      .from('portal_registros')
      .select('id, terapeuta_id, foto_path, foto_thumb_path, registrado_at')
      .not('foto_path', 'is', null)
      .eq('foto_vencida', false)
      .order('registrado_at', { ascending: true })
      .limit(LOTE)

    if (!candidatos || candidatos.length === 0) break

    const ahora = Date.now()
    let procesadosEsteLote = 0

    for (const r of candidatos) {
      const dias = await diasPara(r.terapeuta_id)
      if (dias == null) {
        omitidos.add(r.terapeuta_id)
        continue
      }
      const vencimiento = new Date(r.registrado_at).getTime() + dias * 86400000
      if (ahora < vencimiento) continue

      try {
        const paths = [r.foto_path, r.foto_thumb_path].filter((p): p is string => !!p)
        if (paths.length > 0) await del(paths)
      } catch {
        console.error(`[cron/portal-retencion] fallo al borrar blobs del registro ${r.id}`)
        continue
      }

      await db.from('portal_registros').update({ foto_path: null, foto_thumb_path: null, foto_vencida: true }).eq('id', r.id)
      procesadosEsteLote++
      totalBorrados++
    }

    if (procesadosEsteLote === 0) break
    if (candidatos.length < LOTE) break
  }

  if (omitidos.size > 0) {
    console.error(`[cron/portal-retencion] terapeutas sin fila en portal_retencion_plan, salteados: ${omitidos.size}`)
  }

  return NextResponse.json({ borrados: totalBorrados, terapeutasOmitidos: omitidos.size, timestamp: new Date().toISOString() })
}
