// Instant skeleton for the Integrations route so navigation never looks frozen
// while the server segment loads.
export default function IntegrationsLoading() {
  return (
    <div className="dash-page" style={{ padding: '40px 40px', maxWidth: 760 }}>
      <div style={{ marginBottom: 36, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="skeleton" style={{ width: 160, height: 22, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 320, height: 14, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ padding: 22, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ width: 90, height: 15, borderRadius: 5 }} />
              <div className="skeleton" style={{ width: 160, height: 12, borderRadius: 5 }} />
            </div>
            <div className="skeleton" style={{ width: 84, height: 32, borderRadius: 8, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
