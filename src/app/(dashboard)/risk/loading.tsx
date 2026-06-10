// Instant skeleton for the Risk Monitor.
export default function RiskLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
        <div className="skeleton" style={{ width: 190, height: 24, borderRadius: 7 }} />
        <div className="skeleton" style={{ width: 330, height: 13, borderRadius: 5 }} />
      </div>

      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="widget" style={{ padding: '14px 16px', gap: 10 }}>
            <div className="skeleton" style={{ width: '55%', height: 10, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 44, height: 24, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: '70%', height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div className="insight-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="widget" style={{ padding: 18, gap: 12 }}>
            <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton" style={{ width: '40%', height: 12, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: '60%', height: 10, borderRadius: 4 }} />
              </div>
            </div>
            <div className="skeleton" style={{ width: '100%', height: 34, borderRadius: 8 }} />
            <div className="skeleton" style={{ width: '55%', height: 12, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
