// ⚠️ ENDPOINT TEMPORAL — eliminar una vez confirmado el cálculo de descuento
// institucional en producción con un profesional real. No dejar como deuda
// técnica silenciosa (ver commit que lo introduce).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlanInfo, type PlanKlia, type Modalidad } from '@/lib/mercadopago'

async function getAdminUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', user.email ?? '')
    .eq('activo', true)
    .single()
  return data ?? null
}

export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get('profileId')
  const plan = searchParams.get('plan') as PlanKlia | null
  const modalidad = (searchParams.get('modalidad') ?? 'mensual') as Modalidad

  if (!profileId || !plan || !['esencial', 'profesional', 'premium'].includes(plan)) {
    return NextResponse.json({ error: 'Parámetros profileId y plan (esencial|profesional|premium) son obligatorios' }, { status: 400 })
  }

  const supabase = createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('codigo_descuento_id')
    .eq('id', profileId)
    .single()

  const planInfo = await getPlanInfo(supabase, plan, profileId)
  if (!planInfo) {
    return NextResponse.json({ error: 'Plan no encontrado en Supabase' }, { status: 404 })
  }

  const montoFinal = modalidad === 'mensual' ? planInfo.precio_mensual : planInfo.precio_anual_mensual

  return NextResponse.json({
    profileId,
    plan,
    modalidad,
    codigo_descuento_id: profile?.codigo_descuento_id ?? null,
    precio_mensual_con_descuento: planInfo.precio_mensual,
    precio_anual_mensual_con_descuento: planInfo.precio_anual_mensual,
    porcentaje_descuento_resuelto: planInfo.porcentaje_descuento,
    monto_final_para_modalidad_pedida: montoFinal,
  })
}
