import { DashboardBodySkeleton } from '@/components/dashboard/Skeletons'

// Instant skeleton for the Dashboard Home so navigation never looks frozen.
export default function DashboardLoading() {
  return (
    <div className="dash-page" style={{ padding: '28px 32px 56px', maxWidth: 1480, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div className="dash-header-row" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="skeleton" style={{ width: 260, height: 24, borderRadius: 7 }} />
          <div className="skeleton" style={{ width: 200, height: 13, borderRadius: 5 }} />
        </div>
        <div className="skeleton" style={{ width: 110, height: 32, borderRadius: 8 }} />
      </div>

      <DashboardBodySkeleton />
    </div>
  )
}
