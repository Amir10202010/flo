// Instant skeleton for the Integrations route so navigation never looks frozen
// while the server segment loads.
export default function IntegrationsLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 820, margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="skeleton" style={{ width: 165, height: 26, borderRadius: 7 }} />
        <div className="skeleton" style={{ width: 320, height: 13, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ padding: 22, borderRadius: 16, background: '#FFFFFF', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ width: 90, height: 15, borderRadius: 5 }} />
              <div className="skeleton" style={{ width: 200, height: 12, borderRadius: 5 }} />
            </div>
            <div className="skeleton" style={{ width: 92, height: 34, borderRadius: 8, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
