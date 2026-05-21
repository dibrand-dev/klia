import { notFound } from 'next/navigation'
import PagarSesionClient from './PagarSesionClient'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

interface SesionData {
  hash: string
  estado: string
  monto: number
  moneda: string
  vence_at: string
  mp_preference_id: string | null
  turno: { fecha_hora: string; duracion_min: number; modalidad: string } | null
  profesional: { nombre: string; apellido: string; especialidad: string | null; avatar_url: string | null; matricula: string | null } | null
  paciente: { nombre: string; apellido: string } | null
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klia.com.ar'

async function getSesion(hash: string): Promise<SesionData | null> {
  try {
    const res = await fetch(`${appUrl}/api/pagos/${hash}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function formatFecha(fechaHora: string) {
  const d = parseISO(fechaHora)
  return {
    fecha: format(d, "EEEE d 'de' MMMM, yyyy", { locale: es }),
    hora: format(d, 'HH:mm'),
    fechaCapitalized: format(d, "EEEE d 'de' MMMM, yyyy", { locale: es })
      .replace(/^\w/, c => c.toUpperCase()),
  }
}

export async function generateMetadata({ params }: { params: { hash: string } }) {
  const sesion = await getSesion(params.hash)
  if (!sesion?.profesional) return { title: 'Pagar sesión — KLIA' }
  return {
    title: `Sesión con ${sesion.profesional.nombre} ${sesion.profesional.apellido} — KLIA`,
  }
}

export default async function PagarPage({ params, searchParams }: {
  params: { hash: string }
  searchParams: { status?: string }
}) {
  const sesion = await getSesion(params.hash)
  if (!sesion) notFound()

  const turnoFmt = sesion.turno ? formatFecha(sesion.turno.fecha_hora) : null

  // Build MP init_point URL using preference id
  const mpInitPoint = sesion.mp_preference_id
    ? `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${sesion.mp_preference_id}`
    : null

  return (
    <PagarSesionClient
      sesion={sesion}
      fechaFmt={turnoFmt}
      mpInitPoint={mpInitPoint}
      statusParam={searchParams.status ?? null}
    />
  )
}
