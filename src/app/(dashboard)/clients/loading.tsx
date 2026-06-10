// Instant skeleton for the Clients directory.
export default function ClientsLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
        <div className="skeleton" style={{ width: 150, height: 24, borderRadius: 7 }} />
        <div className="skeleton" style={{ width: 320, height: 13, borderRadius: 5 }} />
      </div>

      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="widget" style={{ padding: '14px 16px', gap: 10 }}>
            <div className="skeleton" style={{ width: '55%', height: 10, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 50, height: 24, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: '70%', height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div className="widget" style={{ padding: 0 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: 180, height: 14, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: 220, height: 30, borderRadius: 9 }} />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--border-light)' }}>
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton" style={{ width: '30%', height: 12, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: '45%', height: 10, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ width: 90, height: 8, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 70, height: 18, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
