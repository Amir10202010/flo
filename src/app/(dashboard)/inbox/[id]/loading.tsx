// Shown immediately while the server fetches the conversation detail.
// Mirrors the redesigned thread shape: a slim header bar, full-width message
// card skeletons, and a faint context rail on the right (hidden on mobile).
export default function ConversationLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: '#fff',
        }}
      >
        <div className="skeleton" style={{ width: 30, height: 30, borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ width: 150, height: 15, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: 220, height: 12, borderRadius: 5 }} />
        </div>
        <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 9, marginLeft: 'auto' }} />
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: 'var(--bg-subtle)',
          }}
        >
          {[88, 64, 120, 72].map((h, i) => (
            <div key={i} className="skeleton" style={{ width: '100%', height: h, borderRadius: 14 }} />
          ))}
        </div>

        <div
          className="loading-rail"
          style={{
            width: 320,
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            background: '#fff',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div className="skeleton" style={{ width: '100%', height: 96, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 12 }} />
        </div>
      </div>
    </div>
  )
}
