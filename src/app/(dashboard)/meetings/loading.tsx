// Instant skeleton for the meetings list.
export default function MeetingsLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
        <div className="skeleton" style={{ width: 190, height: 24, borderRadius: 7 }} />
        <div className="skeleton" style={{ width: 340, height: 13, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 62, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  )
}
