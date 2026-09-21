import { NextRequest, NextResponse } from 'next/server'
import { buscarPaginaOFF, mapearPaginaOFF } from '@/lib/vademecum/openfoodfacts'
import { upsertLoteOFF } from '@/lib/vademecum/upsert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Import inicial, resumible por invocación: procesa UNA página de 100 productos
// por llamada (Vercel Hobby, 60s máx. de duración de función — no alcanza para
// recorrer todo el catálogo de Argentina en una sola invocación). Se invoca
// repetidamente desde un script externo con page=1, 2, 3... hasta que la
// respuesta indique siguiente=null.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.VADEMECUM_IMPORT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: 'page inválido' }, { status: 400 })
  }

  try {
    const respuesta = await buscarPaginaOFF({ page })
    const mapeados = mapearPaginaOFF(respuesta.products ?? [])
    const { alimentos, nutrientes } = await upsertLoteOFF(mapeados)

    const siguiente = page < respuesta.page_count ? page + 1 : null

    return NextResponse.json({
      ok: true,
      page,
      page_count: respuesta.page_count,
      productos_recibidos: respuesta.products?.length ?? 0,
      productos_validos: mapeados.length,
      alimentos_upserted: alimentos,
      nutrientes_upserted: nutrientes,
      siguiente,
    })
  } catch (err: unknown) {
    const mensaje = (err as Error)?.message ?? JSON.stringify(err)
    console.error('[vademecum/off/import] Error:', mensaje)
    return NextResponse.json({ error: mensaje, page }, { status: 502 })
  }
}
