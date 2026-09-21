import { NextRequest, NextResponse } from 'next/server'
import { buscarPaginaOFF, mapearPaginaOFF } from '@/lib/vademecum/openfoodfacts'
import { upsertLoteOFF } from '@/lib/vademecum/upsert'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYNC_CONTROL_ID = 'off_argentina'

// Tope de páginas por corrida — mismo límite de 60s (Hobby) que el import
// inicial, pero acá NO es resumible por invocación externa (es un cron mensual
// sin script que lo reinvoque). 20 páginas x 100 productos = 2000 productos
// modificados como máximo por corrida; para el volumen mensual esperado de
// Argentina en OFF debería sobrar de sobra. Si se llega al tope sin cubrir
// todo el rango, NO se avanza `ultima_sync_exitosa` — la corrida del mes
// siguiente vuelve a cubrir la misma ventana (el upsert es idempotente, así
// que repetir trabajo es inofensivo; lo que hay que evitar es dar por
// sincronizado algo que no se llegó a procesar).
const MAX_PAGINAS_POR_CORRIDA = 20

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  const auth = req.headers.get('authorization')
  if (!isVercelCron && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const inicioCorrida = new Date()

  const { data: control, error: errorControl } = await db
    .from('vademecum_off_sync_control')
    .select('ultima_sync_exitosa')
    .eq('id', SYNC_CONTROL_ID)
    .single()

  if (errorControl) {
    console.error('[cron/vademecum-off-sync] Error leyendo control:', errorControl.message)
    return NextResponse.json({ error: errorControl.message }, { status: 500 })
  }

  // Sin corrida previa: se toma el propio inicio de esta corrida como corte,
  // así no se re-procesa el catálogo entero (para eso está el import inicial
  // por /api/vademecum/off/import) — un cron mensual "primerizo" no debería pasar
  // en la práctica, pero si pasa, no debe comportarse como un import completo.
  const cortePrevio = control?.ultima_sync_exitosa ? new Date(control.ultima_sync_exitosa) : inicioCorrida
  const corteEpoch = Math.floor(cortePrevio.getTime() / 1000)

  let alimentosUpserted = 0
  let nutrientesUpserted = 0
  let paginasProcesadas = 0
  let completado = false

  try {
    for (let page = 1; page <= MAX_PAGINAS_POR_CORRIDA; page++) {
      const respuesta = await buscarPaginaOFF({ page, sortByLastModified: true })
      const productos = respuesta.products ?? []
      paginasProcesadas++

      if (productos.length === 0) {
        completado = true
        break
      }

      const mapeados = mapearPaginaOFF(productos.filter((p) => (p.last_modified_t ?? 0) >= corteEpoch))
      const { alimentos, nutrientes } = await upsertLoteOFF(mapeados)
      alimentosUpserted += alimentos
      nutrientesUpserted += nutrientes

      const masAntiguoDeLaPagina = productos[productos.length - 1]?.last_modified_t ?? 0
      if (masAntiguoDeLaPagina < corteEpoch || page >= respuesta.page_count) {
        completado = true
        break
      }
    }
  } catch (err: unknown) {
    const mensaje = (err as Error)?.message ?? JSON.stringify(err)
    console.error('[cron/vademecum-off-sync] Error durante el sync:', mensaje)
    return NextResponse.json({
      error: mensaje,
      paginas_procesadas: paginasProcesadas,
      alimentos_upserted: alimentosUpserted,
      nutrientes_upserted: nutrientesUpserted,
    }, { status: 502 })
  }

  if (completado) {
    const { error: errorUpdate } = await db
      .from('vademecum_off_sync_control')
      .update({ ultima_sync_exitosa: inicioCorrida.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', SYNC_CONTROL_ID)
    if (errorUpdate) {
      console.error('[cron/vademecum-off-sync] Error guardando timestamp:', errorUpdate.message)
    }
  } else {
    console.warn(`[cron/vademecum-off-sync] Tope de ${MAX_PAGINAS_POR_CORRIDA} páginas alcanzado sin completar — no se avanza ultima_sync_exitosa, la próxima corrida reintenta la misma ventana.`)
  }

  return NextResponse.json({
    ok: true,
    completado,
    corte_usado: cortePrevio.toISOString(),
    paginas_procesadas: paginasProcesadas,
    alimentos_upserted: alimentosUpserted,
    nutrientes_upserted: nutrientesUpserted,
    timestamp: new Date().toISOString(),
  })
}
