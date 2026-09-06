import { NextRequest, NextResponse } from 'next/server'
import { sincronizarTurnoCreado } from '@/lib/sync-google-calendar'

const TURNO_IDS = [
  '43f9efd0-2842-4c92-9a65-552745de069f', // Marcos Rojo
  '0c079bd1-789c-43fd-bf49-0cc6191a66e4', // Franco Colapinto (entrevista, ya corregida)
  '632d7b7e-c031-47e2-b02e-9f70928db0fd', // Kimi Antonelli
  '1d866fef-2483-45ff-9b93-c218660c1682', // Pier Gasly
  'f8fe972d-c480-4846-8ad0-e4dd9c61fdad', // Liam Lawson
  '69b982ff-3934-40e6-b8ad-9631af153a76', // Ana Simone
]
const PROFILE_ID = '4cc00120-212c-4fc6-8481-d6ea074ecd47' // norberto@dibrand.co

export async function GET(req: NextRequest) {
  const recibido = req.nextUrl.searchParams.get('secret') ?? ''
  const esperado = process.env.CRON_SECRET ?? ''
  if (recibido !== esperado) {
    return NextResponse.json({
      error: 'unauthorized',
      debug: {
        largoRecibido: recibido.length,
        largoEsperado: esperado.length,
        recibidoTrim: recibido.trim() === esperado.trim(),
      },
    }, { status: 401 })
  }
  const resultados = []
  for (const turnoId of TURNO_IDS) {
    try {
      await sincronizarTurnoCreado(turnoId, PROFILE_ID)
      resultados.push({ turnoId, ok: true })
    } catch (err) {
      resultados.push({ turnoId, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return NextResponse.json({ resultados })
}
