import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailBienvenida } from '@/lib/email-templates'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

const DIAS_PRUEBA = 21

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json() as { userId?: string }
    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre, apellido, email')
      .eq('id', userId)
      .single()

    if (!profile?.email) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const nombre = profile.nombre ?? profile.email.split('@')[0]

    await enviarEmail({
      destinatario: profile.email,
      nombreDestinatario: nombre,
      asunto: `¡Bienvenido/a a KLIA, ${nombre}!`,
      htmlContent: emailBienvenida(nombre, DIAS_PRUEBA),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error enviando email de bienvenida:', err)
    return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 })
  }
}
