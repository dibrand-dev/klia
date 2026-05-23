'use client'

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

interface FechaFmt {
  fecha: string
  hora: string
  fechaCapitalized: string
}

interface Props {
  sesion: SesionData
  fechaFmt: FechaFmt | null
  mpInitPoint: string | null
  statusParam: string | null
}

function modalidadLabel(m: string): string {
  if (m === 'presencial') return 'Presencial'
  if (m === 'videollamada') return 'Videollamada'
  if (m === 'telefonica') return 'Telefónica'
  return m
}

function formatMonto(monto: number, moneda: string): string {
  if (moneda === 'ARS') return `$${monto.toLocaleString('es-AR')}`
  if (moneda === 'USD') return `USD ${monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  return `${moneda} ${monto}`
}


export default function PagarSesionClient({ sesion, fechaFmt, mpInitPoint, statusParam }: Props) {
  const isPagado = sesion.estado === 'pagado' || statusParam === 'success'
  const isVencido = sesion.estado === 'vencido' || sesion.estado === 'cancelado' || sesion.estado === 'rechazado'
  const isPendiente = !isPagado && !isVencido

  const linkVencido = sesion.vence_at ? new Date(sesion.vence_at) < new Date() : false
  const showPayButton = isPendiente && !linkVencido && !!mpInitPoint

  const prof = sesion.profesional

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5F6FA' }}>
      {/* Header */}
      <header className="flex items-center justify-center py-5" style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>KLIA</span>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-4 w-full" style={{ maxWidth: 440, margin: '0 auto' }}>

        {/* Status banners */}
        {isPagado && (
          <div className="w-full rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--ok-soft)', border: '1px solid var(--ok)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--ok)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ok)' }}>Pago confirmado</p>
              <p className="text-xs opacity-75" style={{ color: 'var(--ok)' }}>Tu sesión está reservada</p>
            </div>
          </div>
        )}

        {isVencido && (
          <div className="w-full rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--danger)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 4V7.5M7 10H7.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
                {sesion.estado === 'rechazado' ? 'Pago rechazado' : 'Enlace vencido'}
              </p>
              <p className="text-xs opacity-75" style={{ color: 'var(--danger)' }}>
                {sesion.estado === 'rechazado'
                  ? 'No se pudo procesar el pago'
                  : 'Este link de pago ya no está disponible'}
              </p>
            </div>
          </div>
        )}

        {statusParam === 'failure' && isPendiente && (
          <div className="w-full rounded-xl px-4 py-3"
            style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--warn)' }}>El pago no fue procesado</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--warn)' }}>Podés intentarlo nuevamente.</p>
          </div>
        )}

        {statusParam === 'pending' && isPendiente && (
          <div className="w-full rounded-xl px-4 py-3"
            style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--warn)' }}>Pago en proceso</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--warn)' }}>Tu pago está siendo procesado. Te notificaremos cuando se confirme.</p>
          </div>
        )}

        {/* Professional card */}
        {prof && (
          <div className="w-full card p-5 flex items-center gap-4">
            {prof.avatar_url ? (
              <img
                src={prof.avatar_url}
                alt={`${prof.nombre} ${prof.apellido}`}
                className="w-16 h-16 rounded-full object-cover shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const next = e.currentTarget.nextElementSibling as HTMLElement | null
                  if (next) next.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold shrink-0"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: prof.avatar_url ? 'none' : 'flex',
              }}
            >
              {prof.nombre?.[0]}{prof.apellido?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
                {prof.nombre} {prof.apellido}
              </p>
              {prof.especialidad && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{prof.especialidad}</p>
              )}
              {prof.matricula && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-2)' }}>Matr. {prof.matricula}</p>
              )}
            </div>
          </div>
        )}

        {/* Session details */}
        {sesion.turno && fechaFmt && (
          <div className="w-full card p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Detalle de la sesión
            </p>
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm shrink-0" style={{ color: 'var(--muted)' }}>Fecha</span>
                <span className="text-sm font-medium text-right" style={{ color: 'var(--ink-2)' }}>
                  {fechaFmt.fechaCapitalized}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>Horario</span>
                <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
                  {fechaFmt.hora} · {sesion.turno.duracion_min} min
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>Modalidad</span>
                <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
                  {modalidadLabel(sesion.turno.modalidad)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Total</span>
                <span className="text-base font-bold" style={{ color: 'var(--ink)' }}>
                  {formatMonto(sesion.monto, sesion.moneda)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment action — pending */}
        {showPayButton && (
          <div className="w-full card p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Completá tu sesión</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Realizá el pago de forma segura con Mercado Pago.
              </p>
            </div>
            <a
              href={mpInitPoint}
              className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl font-semibold text-white text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#009EE3' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 16.5V7.5L16 12L10 16.5Z" fill="white" />
              </svg>
              Pagar con Mercado Pago
            </a>
            {sesion.vence_at && (
              <p className="text-xs text-center" style={{ color: 'var(--muted-2)' }}>
                Este link vence el{' '}
                {new Date(sesion.vence_at).toLocaleDateString('es-AR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            )}
          </div>
        )}

        {/* Paid state */}
        {isPagado && (
          <div className="w-full card p-6 flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--ok-soft)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5L9.5 17L19 7" stroke="var(--ok)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>¡Pago recibido!</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Tu sesión quedó confirmada. Recibirás un email con los detalles.
            </p>
          </div>
        )}

        {/* Expired/rejected state */}
        {isVencido && (
          <div className="w-full card p-5">
            <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
              {sesion.estado === 'rechazado'
                ? 'El pago fue rechazado. Por favor contactá a tu profesional para reprogramar.'
                : 'El tiempo para completar el pago venció. Por favor contactá a tu profesional para reprogramar la sesión.'}
            </p>
          </div>
        )}

        {/* Link expired but sesion still pending */}
        {isPendiente && linkVencido && (
          <div className="w-full card p-5">
            <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
              Este link de pago ha vencido. Por favor contactá a tu profesional para solicitar uno nuevo.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs space-x-3" style={{ color: 'var(--muted-2)' }}>
        <a href="/privacidad" className="hover:underline">Privacidad</a>
        <span>·</span>
        <a href="/terminos" className="hover:underline">Términos</a>
        <span>·</span>
        <span>© 2025 KLIA</span>
      </footer>
    </div>
  )
}
