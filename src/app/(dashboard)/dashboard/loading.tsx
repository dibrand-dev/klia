export default function DashboardLoading() {
  const pulse: React.CSSProperties = {
    background: 'var(--surface-2)',
    borderRadius: 'var(--r-md)',
  }

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        @keyframes klia-skel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        .klia-skel { animation: klia-skel-pulse 1.5s ease-in-out infinite; }
      `}</style>

      <div className="klia-skel" style={{ ...pulse, height: 28, width: 220, marginBottom: 24 }} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="klia-skel"
            style={{
              ...pulse,
              height: 96,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              boxShadow: 'none',
            }}
          />
        ))}
      </div>

      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          background: 'var(--surface)',
          padding: 16,
        }}
      >
        <div className="klia-skel" style={{ ...pulse, height: 18, width: 160, marginBottom: 16 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="klia-skel"
            style={{ ...pulse, height: 48, marginBottom: 8 }}
          />
        ))}
      </div>
    </div>
  )
}
