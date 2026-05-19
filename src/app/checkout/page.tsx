import { redirect } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'

export const metadata = { title: 'Checkout — KLIA' }

const CheckoutBrick = dynamic(() => import('@/components/suscripcion/CheckoutBrick'), { ssr: false })

const PLAN_NOMBRES: Record<string, string> = {
  esencial: 'Esencial',
  profesional: 'Profesional',
  premium: 'Premium',
}

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: { preference_id?: string; plan?: string; monto?: string; modalidad?: string }
}) {
  const preferenceId = searchParams.preference_id ?? ''
  const plan = searchParams.plan ?? ''
  const monto = Number(searchParams.monto ?? 0)
  const modalidad = (searchParams.modalidad ?? 'mensual') as 'mensual' | 'anual'

  if (!preferenceId || !plan || !monto) redirect('/planes')

  const isProduction = process.env.MP_USE_PRODUCTION === 'true'
  const mpPublicKey = isProduction
    ? (process.env.MP_PUBLIC_KEY_PROD ?? '')
    : (process.env.MP_PUBLIC_KEY_TEST ?? '')

  const planNombre = PLAN_NOMBRES[plan] ?? plan

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#0B1220',
      background: '#FAFBFC',
      backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(79,70,229,0.04) 0%, transparent 35%)',
      fontSize: 14,
      lineHeight: 1.55,
      WebkitFontSmoothing: 'antialiased' as const,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
    }}>

      {/* Logo */}
      <div style={{ padding: '28px 24px 0', display: 'flex', justifyContent: 'center' }}>
        <Image src="/logo.svg" alt="KLIA" width={80} height={36} style={{ height: 36, width: 'auto' }} />
      </div>

      <main style={{ flex: 1, width: '100%', maxWidth: 600, margin: '0 auto', padding: '40px 24px 60px' }}>

        {/* Back link */}
        <Link
          href="/cuenta-bloqueada"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#5B6472', textDecoration: 'none', marginBottom: 28 }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Cambiar plan
        </Link>

        {/* Plan summary */}
        <div style={{ background: '#fff', border: '1px solid #E7E9EE', borderRadius: 16, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }}>
          <div>
            <p style={{ fontWeight: 600, color: '#0B1220', margin: 0, fontSize: 15 }}>Plan {planNombre}</p>
            <p style={{ fontSize: 13, color: '#5B6472', margin: '2px 0 0', textTransform: 'capitalize' }}>{modalidad}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#0B1220', margin: 0 }}>
              ${monto.toLocaleString('es-AR')}
            </p>
            <p style={{ fontSize: 12, color: '#8A93A1', margin: '2px 0 0' }}>/mes · ARS</p>
          </div>
        </div>

        {/* Checkout Brick */}
        <CheckoutBrick
          preferenceId={preferenceId}
          monto={monto}
          plan={plan}
          modalidad={modalidad}
          publicKey={mpPublicKey}
        />

      </main>

      <footer style={{ marginTop: 'auto', padding: '22px 24px 28px', textAlign: 'center', fontSize: 12, color: '#AEB5C0', lineHeight: 1.7 }}>
        <span style={{ display: 'block', marginBottom: 4 }}>
          ¿Necesitás ayuda?{' '}
          <a href="mailto:hola@klia.com.ar" style={{ color: '#8A93A1', textDecoration: 'none', fontWeight: 500 }}>
            hola@klia.com.ar
          </a>
        </span>
        <a href="/privacidad" style={{ color: '#AEB5C0', textDecoration: 'none' }}>Política de Privacidad</a>
        <span style={{ color: '#AEB5C0', margin: '0 6px' }}>·</span>
        <span>© 2026 KLIA</span>
      </footer>
    </div>
  )
}
