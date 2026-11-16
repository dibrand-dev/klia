import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { diasRetencionPorPlan } from '@/lib/portal/retencion'
import { tieneAccesoActivadoAlgunaVez } from '@/lib/portal/acceso'

export const runtime = 'nodejs'

// Tercera excepción al contrato de accesoHabilitado (igual que activar y
// recuperar): esto corre ANTES de que exista un acceso 'activo' — solo lee
// la propia fila 'invitado' del usuario autenticado por el hash, para
// mostrar el nombre del profesional y el email en la pantalla Activar.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = serviceClient()
  const { data: acceso } = await db
    .from('paciente_accesos')
    .select('email, terapeuta_id')
    .eq('auth_user_id', user.id)
    .eq('estado', 'invitado')
    .order('invitado_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!acceso) {
    return NextResponse.json({ error: 'sin_invitacion', message: 'No encontramos una invitación pendiente para esta cuenta.' }, { status: 404 })
  }

  const { data: profile } = await db
    .from('profiles')
    .select('nombre, apellido, especialidad, plan')
    .eq('id', acceso.terapeuta_id)
    .maybeSingle()

  const diasRetencion = await diasRetencionPorPlan(db, profile?.plan ?? null)

  // Modo "aceptar invitación" (sin crear otra contraseña): lo decide el
  // server, nunca un query param — ver tieneAccesoActivadoAlgunaVez.
  const modoAceptar = await tieneAccesoActivadoAlgunaVez(db, user.id)

  return NextResponse.json({
    profesionalNombre: [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'Tu profesional',
    especialidad: profile?.especialidad ?? null,
    pacienteEmail: acceso.email,
    diasRetencion,
    modoAceptar,
  })
}
