// Instant skeleton for Insights.
export default function InsightsLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
        <div className="skeleton" style={{ width: 150, height: 24, borderRadius: 7 }} />
        <div className="skeleton" style={{ width: 340, height: 13, borderRadius: 5 }} />
      </div>

      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="widget" style={{ padding: '14px 16px', gap: 10 }}>
            <div className="skeleton" style={{ width: '55%', height: 10, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 52, height: 24, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: '78%', height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div className="widget" style={{ padding: 16, gap: 12 }}>
        <div className="skeleton" style={{ width: 200, height: 14, borderRadius: 5 }} />
        <div className="insight-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 76, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
