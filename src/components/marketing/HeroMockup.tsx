const ITEMS = [
  { ini: 'AP', bg: 'rgba(220,43,85,0.1)',  col: '#DC2B55', name: 'Alex Peterson', badge: 'HOT',  bCls: 'priority-hot',      msg: "Sounds good, price works — when can we start?",        ch: 'Telegram', t: '2m',  delayClass: 'delay-100' },
  { ini: 'KL', bg: 'rgba(194,98,10,0.1)',  col: '#C2620A', name: 'Karina Lee',    badge: 'ATTN', bCls: 'priority-attention', msg: 'Still thinking it over, need to check with my team...', ch: 'Gmail',    t: '3h',  delayClass: 'delay-300' },
  { ini: 'MJ', bg: 'rgba(79,92,244,0.1)',  col: '#4F5CF4', name: 'Mark Johnson',  badge: 'COLD', bCls: 'priority-cold',     msg: "Thanks, I'll follow up later. Busy right now.",          ch: 'Telegram', t: '1d',  delayClass: 'delay-500' },
]

export default function HeroMockup() {
  return (
    <div className="animate-float" style={{ position: 'relative' }}>
      <div
        style={{
          width: 360,
          borderRadius: 14,
          overflow: 'hidden',
          background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 24px 60px rgba(12,18,60,0.14), 0 0 0 1px rgba(12,18,60,0.04)',
          transform: 'perspective(1000px) rotateY(-4deg) rotateX(1deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Browser chrome */}
        <div style={{ padding: '9px 14px', background: '#F8F9FF', borderBottom: '1px solid #ECEEF8', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#FF5F57','#FEBC2E','#28C840'].map((c,i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
          </div>
          <div style={{ flex: 1, height: 22, borderRadius: 5, background: '#EEF0F9', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
            <span style={{ fontSize: 10, color: '#8D93BE', fontFamily: 'monospace' }}>flo.app/inbox</span>
          </div>
        </div>

        {/* App shell */}
        <div style={{ display: 'flex', height: 400 }}>
          {/* Sidebar — mirrors the real dashboard nav */}
          <div style={{ width: 118, background: '#F6F8FE', borderRight: '1px solid #ECEEF8', display: 'flex', flexDirection: 'column', padding: '12px 8px', gap: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#0C0E1D', letterSpacing: '-0.03em', lineHeight: 1 }}>flo</span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', marginBottom: 6, display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'Inbox', active: true },
                { label: 'Integrations', active: false },
                { label: 'Settings', active: false },
              ].map(item => (
                <div key={item.label} style={{ padding: '6px 8px', borderRadius: 7, background: item.active ? 'var(--accent-dim)' : 'transparent', color: item.active ? 'var(--accent)' : '#8D93BE', fontSize: 10.5, fontWeight: item.active ? 600 : 500, whiteSpace: 'nowrap' }}>
                  {item.label}
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px', background: '#FFFFFF', borderRadius: 8, border: '1px solid #ECEEF8' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AM</div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: '#0C0E1D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Amir</div>
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #ECEEF8' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0C0E1D' }}>Inbox</span>
            </div>

            {ITEMS.map((c, i) => (
              <div
                key={i}
                className={`reveal-item ${c.delayClass}`}
                style={{
                  padding: '10px 12px',
                  borderBottom: i < 2 ? '1px solid #ECEEF8' : 'none',
                  background: i === 0 ? 'rgba(79,92,244,0.04)' : '#FFFFFF',
                  borderLeft: `2px solid ${i === 0 ? '#4F5CF4' : 'transparent'}`,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.bg, color: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{c.ini}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0C0E1D' }}>{c.name}</span>
                      <span className={`priority-badge ${c.bCls}`} style={{ fontSize: 8 }}>{c.badge}</span>
                    </div>
                    <p style={{ fontSize: 10.5, color: '#4B5282', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{c.msg}</p>
                    <span style={{ fontSize: 9.5, color: '#8D93BE' }}>{c.ch} · {c.t}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* AI analysis bar */}
            <div
              className="reveal-item delay-800"
              style={{ margin: '10px 10px 0', padding: '8px 10px', borderRadius: 9, background: 'rgba(220,43,85,0.06)', border: '1px solid rgba(220,43,85,0.15)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div className="animate-pulse-s" style={{ width: 5, height: 5, borderRadius: '50%', background: '#DC2B55' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#DC2B55', letterSpacing: '0.07em', textTransform: 'uppercase' }}>AI · HIGH RISK</span>
              </div>
              <p style={{ fontSize: 10, color: '#4B5282', margin: '0 0 3px', lineHeight: 1.4 }}>Alex is ready to buy — needs a response.</p>
              <p style={{ fontSize: 10, color: '#4F5CF4', margin: 0, fontWeight: 500 }}>→ Reply within 30 minutes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
