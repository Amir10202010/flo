// Instant skeleton for the Dashboard Home so navigation never looks frozen.
export default function DashboardLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div className="dash-header-row" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="skeleton" style={{ width: 260, height: 24, borderRadius: 7 }} />
          <div className="skeleton" style={{ width: 200, height: 13, borderRadius: 5 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skeleton" style={{ width: 110, height: 32, borderRadius: 100 }} />
          <div className="skeleton" style={{ width: 110, height: 32, borderRadius: 8 }} />
        </div>
      </div>

      {/* Executive grid */}
      <div className="exec-grid" style={{ marginBottom: 14 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="widget" style={{ padding: '14px 16px', gap: 10 }}>
            <div className="skeleton" style={{ width: '60%', height: 10, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 54, height: 24, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: '80%', height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="dash-main-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="widget" style={{ padding: 16, gap: 12 }}>
            <div className="skeleton" style={{ width: 180, height: 14, borderRadius: 5 }} />
            <div className="skeleton" style={{ width: '100%', height: 150, borderRadius: 12 }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="skeleton" style={{ width: '40%', height: 11, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: '70%', height: 10, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="widget" style={{ padding: 16, gap: 12 }}>
            <div className="skeleton" style={{ width: 160, height: 14, borderRadius: 5 }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ width: '100%', height: 40, borderRadius: 10 }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="widget" style={{ padding: 16, gap: 12 }}>
              <div className="skeleton" style={{ width: 140, height: 14, borderRadius: 5 }} />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="skeleton" style={{ width: '100%', height: 44, borderRadius: 10 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
