const CONVS = [
  { ini: 'AP', bg: 'rgba(220,43,85,0.1)',  col: '#DC2B55', name: 'Alex Peterson', priority: 'HOT',  cls: 'priority-hot',       preview: "Sounds good, price works — when can we start?",          meta: 'Telegram · 2m',  unread: 3, selected: true  },
  { ini: 'KL', bg: 'rgba(194,98,10,0.1)',  col: '#C2620A', name: 'Karina Lee',    priority: 'ATTN', cls: 'priority-attention',  preview: 'Still thinking it over, need to check with my team...',  meta: 'Gmail · 3h',     unread: 1, selected: false },
  { ini: 'MJ', bg: 'rgba(79,92,244,0.1)',  col: '#4F5CF4', name: 'Mark Johnson',  priority: 'COLD', cls: 'priority-cold',       preview: "Thanks, I'll follow up later. Busy right now.",           meta: 'Telegram · 1d',  unread: 0, selected: false },
]

const MESSAGES = [
  { out: false, text: 'Hi! Reviewed your pricing. Is the service €3,800?', time: '14:30' },
  { out: true,  text: 'Yes, that includes full installation and a 2-year warranty.', time: '14:35' },
  { out: false, text: "Sounds good, price works — when can we start?", time: '14:52' },
]

export default function ProductDemo() {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        className="demo-wrap"
        style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)', background: '#FFFFFF' }}
      >
        {/* Browser chrome */}
        <div style={{ padding: '10px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#FF5F57','#FEBC2E','#28C840'].map((c,i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
          </div>
          <div style={{ flex: 1, maxWidth: 240, height: 26, borderRadius: 6, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(79,92,244,0.4)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>app.flo.ai/inbox</span>
          </div>
        </div>

        {/* App layout */}
        <div className="demo-app-layout" style={{ display: 'flex', height: 520 }}>
          {/* Sidebar */}
          <div className="demo-sidebar" style={{ width: 200, borderRight: '1px solid var(--border-light)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>flo</span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginBottom: 7, display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'Inbox', active: true, count: 3 },
                { label: 'Integrations', active: false },
                { label: 'Settings', active: false },
              ].map(item => (
                <div key={item.label} style={{ padding: '7px 10px', borderRadius: 8, background: item.active ? 'var(--accent-dim)' : 'transparent', color: item.active ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 13, fontWeight: item.active ? 600 : 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {item.label}
                  {item.count && <span style={{ background: 'var(--accent)', color: '#fff', width: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.count}</span>}
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', background: 'var(--bg-elevated)', borderRadius: 9, border: '1px solid var(--border-light)' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AM</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Amir</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Team Lead</div>
              </div>
            </div>
          </div>

          {/* Conversation list */}
          <div className="demo-conv-list" style={{ borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Inbox</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>3 conversations</span>
            </div>
            {CONVS.map((c, i) => (
              <div key={i} style={{ padding: '11px 14px', borderBottom: i < 2 ? '1px solid var(--border-light)' : 'none', background: c.selected ? 'rgba(79,92,244,0.04)' : '#FFFFFF', borderLeft: `2px solid ${c.selected ? 'var(--accent)' : 'transparent'}`, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'default' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.bg, color: c.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{c.ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                    <span className={`priority-badge ${c.cls}`} style={{ fontSize: 9 }}>{c.priority}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{c.preview}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.meta}</span>
                    {c.unread > 0 && <span style={{ width: 17, height: 17, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Thread + AI */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-subtle)' }}>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-light)', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Alex Peterson</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Telegram · last message 2 minutes ago</div>
                </div>
                <span className="priority-badge priority-hot">HOT</span>
              </div>
              <div style={{ padding: '10px 13px', borderRadius: 9, background: 'rgba(220,43,85,0.05)', border: '1px solid rgba(220,43,85,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2B55', animation: 'pulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2B55', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI · HIGH RISK</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 5px', lineHeight: 1.5 }}>
                  Client is ready to buy. Delay &gt;2h will reduce conversion.
                </p>
                <p style={{ fontSize: 12, color: 'var(--accent)', margin: 0, fontWeight: 600 }}>
                  → Reply with a concrete start date
                </p>
              </div>
            </div>

            <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'hidden' }}>
              {MESSAGES.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.out ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '76%', padding: '9px 13px', borderRadius: m.out ? '13px 13px 3px 13px' : '13px 13px 13px 3px', background: m.out ? 'var(--accent)' : '#FFFFFF', border: `1px solid ${m.out ? 'transparent' : 'var(--border)'}`, color: m.out ? '#fff' : 'var(--text-primary)', fontSize: 13, lineHeight: 1.5, boxShadow: m.out ? 'none' : 'var(--shadow-xs)' }}>
                    {m.text}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{m.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to bottom, transparent, #FFFFFF)', pointerEvents: 'none' }} />
    </div>
  )
}
