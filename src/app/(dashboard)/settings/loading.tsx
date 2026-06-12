// Instant skeleton for the Settings route so navigation never looks frozen
// while the server segment loads.
export default function SettingsLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 820, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="skeleton" style={{ width: 130, height: 26, borderRadius: 7 }} />
        <div className="skeleton" style={{ width: 250, height: 13, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="widget">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--border-light)' }}>
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
              <div className="skeleton" style={{ width: 110, height: 13, borderRadius: 5 }} />
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="skeleton" style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skeleton" style={{ width: '35%', height: 14, borderRadius: 5 }} />
                <div className="skeleton" style={{ width: '55%', height: 11, borderRadius: 5 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
