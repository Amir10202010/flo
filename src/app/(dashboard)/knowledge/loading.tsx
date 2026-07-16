// Instant skeleton for the Knowledge graph view.
export default function KnowledgeLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 40px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
        <div className="skeleton" style={{ width: 210, height: 24, borderRadius: 7 }} />
        <div className="skeleton" style={{ width: 420, height: 13, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <div className="skeleton" style={{ flex: 1, height: 560, borderRadius: 14 }} />
        <div className="skeleton graph-sidebar-skeleton" style={{ width: 300, height: 560, borderRadius: 14 }} />
      </div>
    </div>
  )
}
