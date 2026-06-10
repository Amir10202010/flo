// Instant skeleton for Analytics.
export default function AnalyticsLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
        <div className="skeleton" style={{ width: 180, height: 24, borderRadius: 7 }} />
        <div className="skeleton" style={{ width: 300, height: 13, borderRadius: 5 }} />
      </div>

      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="widget" style={{ padding: '14px 16px', gap: 10 }}>
            <div className="skeleton" style={{ width: '55%', height: 10, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 60, height: 24, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: '75%', height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div className="ana-grid">
        <div className="widget ana-span2" style={{ padding: 18, gap: 12 }}>
          <div className="skeleton" style={{ width: 160, height: 14, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: '100%', height: 210, borderRadius: 12 }} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="widget" style={{ padding: 18, gap: 12 }}>
            <div className="skeleton" style={{ width: 150, height: 14, borderRadius: 5 }} />
            <div className="skeleton" style={{ width: '100%', height: 150, borderRadius: 12 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
