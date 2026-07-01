/** Route-level skeleton while the object page's records load. */
export default function Loading() {
  const block = (h: number, w: string, mb = 10) => (
    <div
      style={{
        height: h,
        width: w,
        marginBottom: mb,
        borderRadius: 8,
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-light)',
      }}
    />
  )
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      {block(26, '220px', 8)}
      {block(14, '340px', 22)}
      {block(38, '100%', 14)}
      {block(320, '100%', 0)}
    </div>
  )
}
