// Instant skeleton for the Settings route so navigation never looks frozen
// while the server segment loads.
export default function SettingsLoading() {
  return (
    <div className="dash-page" style={{ padding: '40px 40px', maxWidth: 760 }}>
      <div style={{ marginBottom: 36, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ width: 140, height: 22, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 220, height: 14, borderRadius: 5 }} />
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="skeleton" style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ width: 120, height: 15, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: 180, height: 12, borderRadius: 5 }} />
        </div>
      </div>
    </div>
  )
}
