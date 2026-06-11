// Shown immediately while the server fetches the conversation detail.
// Gives instant visual feedback before the DB round-trip completes.
export default function ConversationLoading() {
  return (
    <>
      {/* Header skeleton */}
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton" style={{ width: 160, height: 18, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 100, height: 13, borderRadius: 5 }} />
          </div>
          <div className="skeleton" style={{ width: 52, height: 20, borderRadius: 5 }} />
        </div>
      </div>

      {/* Message skeletons */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          { out: false, w: 260 },
          { out: true,  w: 200 },
          { out: false, w: 300 },
          { out: true,  w: 180 },
        ].map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.out ? 'flex-end' : 'flex-start', gap: 4 }}>
            <div className="skeleton" style={{ width: m.w, height: 40, borderRadius: m.out ? '16px 16px 5px 16px' : '16px 16px 16px 5px' }} />
            <div className="skeleton" style={{ width: 48, height: 10, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </>
  )
}
