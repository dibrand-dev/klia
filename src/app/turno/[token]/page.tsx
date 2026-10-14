import type { Metadata } from 'next'
import TurnoAccionClient from './TurnoAccionClient'
import { formatFechaHoraAR } from '@/lib/tz'
import { turnoEstaPagado } from '@/lib/turno-pago'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tu turno — KLIA',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADOS_CERRADOS = ['realizado', 'no_asistio']

function PantallaGenerica({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: 'var(--surface-2)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="KLIA" style={{ height: 28, width: 'auto', marginBottom: 32 }} />
      <div className="w-full card p-6 flex flex-col items-center text-center gap-3" style={{ maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: 'var(--surface-2)' }}>
          🔒
        </div>
        <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{titulo}</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{texto}</p>
      </div>
    </div>
  )
}

export default async function TurnoAccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ accion?: string }>
}) {
  const { token } = await params
  const { accion } = await searchParams

  if (!UUID_RE.test(token)) {
    return <PantallaGenerica titulo="Link no disponible" texto="Este link no es válido. Por favor contactá directamente a tu profesional." />
  }

  const db = serviceClient()

  const { data: turno } = await db
    .from('turnos')
    .select(`
      estado, fecha_hora, duracion_min, modalidad, pagado, estado_pago, monto_pagado, monto,
      terapeuta:profiles(nombre, apellido, especialidad)
    `)
    .eq('token_accion', token)
    .maybeSingle()

  if (!turno) {
    return <PantallaGenerica titulo="Link no disponible" texto="Este link no es válido. Por favor contactá directamente a tu profesional." />
  }

  const terapeuta = turno.terapeuta as unknown as { nombre: string; apellido: string; especialidad: string | null } | null
  const { fecha, hora } = formatFechaHoraAR(turno.fecha_hora)
  const yaPaso = new Date(turno.fecha_hora) < new Date()

  // Precedencia: cancelado > realizado/no_asistio > pasado > pendiente/confirmado.
  if (turno.estado === 'cancelado') {
    return (
      <TurnoAccionClient
        token={token}
        estadoInicial="cancelado"
        accionInicial={null}
        profesionalNombre={`${terapeuta?.nombre ?? ''} ${terapeuta?.apellido ?? ''}`.trim()}
        profesionalEspecialidad={terapeuta?.especialidad ?? null}
        fecha={fecha}
        hora={hora}
        duracionMin={turno.duracion_min}
        modalidad={turno.modalidad}
        pagado={turnoEstaPagado(turno)}
      />
    )
  }

  if (ESTADOS_CERRADOS.includes(turno.estado) || yaPaso) {
    return <PantallaGenerica titulo="Este turno ya pasó" texto="No hay ninguna acción disponible para este turno." />
  }

  const accionInicial = accion === 'confirmar' || accion === 'cancelar' ? accion : null

  return (
    <TurnoAccionClient
      token={token}
      estadoInicial={turno.estado === 'confirmado' ? 'confirmado' : 'pendiente'}
      accionInicial={accionInicial}
      profesionalNombre={`${terapeuta?.nombre ?? ''} ${terapeuta?.apellido ?? ''}`.trim()}
      profesionalEspecialidad={terapeuta?.especialidad ?? null}
      fecha={fecha}
      hora={hora}
      duracionMin={turno.duracion_min}
      modalidad={turno.modalidad}
      pagado={turnoEstaPagado(turno)}
    />
  )
}
