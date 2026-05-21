import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/lib/brevo'
import { emailPagoSesionPendiente } from '@/lib/email-templates'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Database } from '@/types/database'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function formatFechaHora(fechaHora: string) {
  const d = parseISO(fechaHora)
  return {
    fecha: format(d, "EEEE d 'de' MMMM, yyyy", { locale: es }),
    hora: format(d, 'HH:mm'),
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json() as { turno_id: string }
  if (!body.turno_id) return NextResponse.json({ error: 'turno_id requerido' }, { status: 400 })

  const db = serviceClient()

  // 1. Get turno + paciente
  const { data: turno } = await db
    .from('turnos')
    .select('*, paciente:pacientes(*)')
    .eq('id', body.turno_id)
    .eq('terapeuta_id', user.id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (!turno.monto) return NextResponse.json({ error: 'El turno no tiene monto definido' }, { status: 400 })

  // 2. Get professional profile
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const p = profile as Record<string, unknown> | null
  if (!p?.mp_access_token) {
    return NextResponse.json({ error: 'No tenés Mercado Pago conectado' }, { status: 400 })
  }

  const ventanaHoras = (p.cobros_ventana_horas as number | null) ?? 48
  const mensajePaciente = (p.cobros_mensaje_paciente as string | null) ?? ''

  // 3. Generate hash & expiry
  const hash = shortId()
  const venceAt = new Date(Date.now() + ventanaHoras * 3600 * 1000).toISOString()

  const { fecha, hora } = formatFechaHora(turno.fecha_hora)
  const paciente = turno.paciente as Record<string, unknown> | null

  // 4. Create MP Preference using professional's access_token
  const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.mp_access_token as string}`,
    },
    body: JSON.stringify({
      items: [{
        title: `Sesión con ${p.nombre as string} ${p.apellido as string}`,
        quantity: 1,
        unit_price: turno.monto,
        currency_id: turno.moneda ?? 'ARS',
      }],
      payer: { email: (paciente?.email as string | null) ?? undefined },
      back_urls: {
        success: `${appUrl}/pagar/${hash}?status=success`,
        failure: `${appUrl}/pagar/${hash}?status=failure`,
        pending: `${appUrl}/pagar/${hash}?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${appUrl}/api/pagos/webhook`,
      metadata: { hash, turno_id: turno.id, terapeuta_id: user.id },
      statement_descriptor: 'KLIA SESION',
    }),
  })

  if (!prefRes.ok) {
    const errText = await prefRes.text()
    console.error('[pagos/crear] MP preference error:', errText)
    return NextResponse.json({ error: 'Error al crear preferencia de pago' }, { status: 502 })
  }

  const pref = await prefRes.json() as { id: string; init_point: string }

  // 5. Save sesion_pago
  const { data: sesion, error: sesionErr } = await db
    .from('sesiones_pago')
    .insert({
      turno_id: turno.id,
      terapeuta_id: user.id,
      paciente_id: turno.paciente_id,
      hash,
      monto: turno.monto,
      moneda: turno.moneda ?? 'ARS',
      mp_preference_id: pref.id,
      vence_at: venceAt,
    })
    .select()
    .single()

  if (sesionErr) {
    console.error('[pagos/crear] sesion_pago insert error:', sesionErr)
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
  }

  // 6. Send email to patient
  if (paciente?.email) {
    try {
      const html = emailPagoSesionPendiente({
        pacienteNombre: `${paciente.nombre as string} ${paciente.apellido as string}`,
        profesionalNombre: `${p.nombre as string} ${p.apellido as string}`,
        profesionalEspecialidad: (profile?.especialidad as string | null) ?? '',
        fecha,
        hora,
        duracion: turno.duracion_min,
        modalidad: turno.modalidad,
        monto: turno.monto,
        moneda: turno.moneda ?? 'ARS',
        hash,
        venceAt,
        mensajePersonalizado: mensajePaciente,
      })
      await enviarEmail({
        destinatario: paciente.email as string,
        nombreDestinatario: `${paciente.nombre as string} ${paciente.apellido as string}`,
        asunto: `Tu sesión con ${p.nombre as string} ${p.apellido as string} — Completá el pago`,
        htmlContent: html,
      })
    } catch (e) {
      console.error('[pagos/crear] email error:', e)
    }
  }

  return NextResponse.json({
    hash,
    payment_url: pref.init_point,
    sesion_id: sesion!.id,
  })
}
