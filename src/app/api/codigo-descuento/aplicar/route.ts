import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { codigo } = body as { codigo?: string }
  if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
    return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('aplicar_codigo_descuento', {
    p_profile_id: user.id,
    p_codigo: codigo.trim(),
  })

  if (error) {
    console.error('[codigo-descuento] Error al aplicar código:', error)
    return NextResponse.json({ error: 'Error al validar el código' }, { status: 500 })
  }

  const result = data as { success: true; porcentaje_descuento: number } | { success: false; error: string }

  if (!result.success) {
    const mensajes: Record<string, string> = {
      codigo_invalido: 'El código ingresado no es válido.',
      usos_agotados: 'Este código ya alcanzó su límite de usos.',
      ya_tiene_codigo: 'Tu cuenta ya tiene un código de descuento aplicado.',
    }
    return NextResponse.json(
      { error: mensajes[result.error] ?? 'No se pudo aplicar el código.' },
      { status: 400 },
    )
  }

  return NextResponse.json({ ok: true, porcentaje_descuento: result.porcentaje_descuento })
}
