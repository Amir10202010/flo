const CONVS = [
  { initials: 'AP', color: '#3B5BDB', bg: 'rgba(59,91,219,0.18)', name: 'Alex Peterson', priority: 'HOT' as const, cls: 'priority-hot', text: "Sounds good, price works — when can we start?", meta: 'Telegram · 2m', unread: 3 },
  { initials: 'KL', color: '#A855F7', bg: 'rgba(168,85,247,0.18)', name: 'Karina Lee',    priority: 'ATTENTION' as const, cls: 'priority-attention', text: 'Still thinking it over, need to check with my team...', meta: 'Gmail · 3h',    unread: 1 },
  { initials: 'MJ', color: '#6B7280', bg: 'rgba(107,114,128,0.18)', name: 'Mark Johnson', priority: 'COLD' as const, cls: 'priority-cold', text: "Thanks, I'll follow up later. Busy right now.", meta: 'Telegram · yesterday', unread: 0 },
]

export default function InboxPreview() {
  return (
    <div style={{ width: '100%', maxWidth: 540, margin: '0 auto' }}>
      <div
        className="surface"
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(91,108,245,0.12)',
        }}
      >
        {/* Window chrome */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c, opacity: 0.85 }} />
            ))}
          </div>
          <div style={{ flex: 1, marginLeft: 8, height: 24, borderRadius: 5, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>flo.ai/inbox</span>
          </div>
        </div>

        {/* Inbox header */}
        <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Inbox</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['HOT', 'ALL', 'COLD'] as const).map((t, i) => (
              <span
                key={t}
                style={{
                  padding: '2px 8px',
                  borderRadius: 5,
                  fontSize: 10,
                  fontWeight: 600,
                  background: i === 0 ? 'rgba(245,72,106,0.12)' : 'var(--bg-elevated)',
                  color: i === 0 ? 'var(--hot)' : 'var(--text-muted)',
                  border: `1px solid ${i === 0 ? 'var(--hot-border)' : 'var(--border)'}`,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Conversation rows */}
        {CONVS.map((c, i) => (
          <div
            key={i}
            style={{
              padding: '12px 16px',
              borderBottom: i < CONVS.length - 1 ? '1px solid var(--border-light)' : 'none',
              background: i === 0 ? 'rgba(91,108,245,0.04)' : 'transparent',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <div className="avatar" style={{ background: c.bg, color: c.color, fontSize: 12 }}>{c.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                <span className={`priority-badge ${c.cls}`}>{c.priority}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.text}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.meta}</span>
                {c.unread > 0 && (
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* AI bar */}
        <div style={{ padding: '10px 16px', background: 'rgba(91,108,245,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--hot)', flexShrink: 0, animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            AI: <span style={{ color: 'var(--text-primary)' }}>Alex is waiting — reply within the next 30 min</span>
          </span>
        </div>
      </div>
    </div>
  )
}
