import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pacienteId = searchParams.get('pacienteId')
  if (!pacienteId) return NextResponse.json({ error: 'pacienteId requerido' }, { status: 400 })

  const { data: archivos } = await supabase
    .from('archivos_paciente')
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('terapeuta_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ archivos: archivos ?? [] })
}
