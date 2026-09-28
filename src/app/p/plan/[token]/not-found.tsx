// Mismo componente para token inexistente, revocado o vencido — nunca se
// distingue la causa ni se expone ningún dato del plan. Next.js sirve esto
// con status 404 automáticamente al ejecutarse vía notFound() en page.tsx.
export const metadata = {
  robots: { index: false, follow: false },
  title: 'Enlace no disponible',
}

export default function PlanPublicoNoDisponible() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', textAlign: 'center', background: '#fff', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: '#F7F8FB', border: '1px solid #E5E7EF',
          display: 'grid', placeItems: 'center', margin: '0 auto 18px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5A607A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 4 8M8 12h3M3 3l18 18" />
          </svg>
        </div>
        <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 8px', fontFamily: 'var(--font-geist-sans, Geist), Inter, sans-serif', fontWeight: 600, color: '#0E1430' }}>
          Este enlace ya no está disponible
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: '#5A607A', maxWidth: 300, margin: '0 auto' }}>
          Pedile a tu profesional que te comparta uno nuevo.
        </p>
      </div>
    </div>
  )
}
