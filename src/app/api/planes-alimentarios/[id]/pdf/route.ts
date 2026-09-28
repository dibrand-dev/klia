import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveTerapeutaIdServer } from '@/lib/auth/getEffectiveTerapeutaId'
import { serviceClient } from '@/lib/supabase/service'
import { obtenerDatosPlanAlimentario } from '@/lib/nutricion/plan-datos-completos'
import { generarPdfPlanAlimentario } from '@/lib/planillas/plan-alimentario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const efectivo = await getEffectiveTerapeutaIdServer(supabase)
  if (!efectivo) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()

  const [datos, { data: plan }] = await Promise.all([
    obtenerDatosPlanAlimentario(db, params.id, efectivo.terapeutaId),
    db.from('planes_alimentarios').select('paciente_id').eq('id', params.id).eq('terapeuta_id', efectivo.terapeutaId).maybeSingle(),
  ])
  if (!datos || !plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const { data: paciente } = await db.from('pacientes').select('apellido').eq('id', plan.paciente_id).single()

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPdfPlanAlimentario(datos)
  } catch (err) {
    console.error('[planes-alimentarios/[id]/pdf] PDF generation failed:', err)
    return NextResponse.json(
      { error: 'Error al generar el PDF', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  const filename = `Plan_Alimentario_${paciente?.apellido ?? 'paciente'}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    },
  })
}
