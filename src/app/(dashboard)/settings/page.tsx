import { getCurrentUser } from '@/lib/auth'
import SignOutButton from '@/components/ui/SignOutButton'

export default async function SettingsPage() {
  const user = await getCurrentUser()

  const userName  = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null
  const userEmail = user?.email ?? null
  const display   = userName ?? userEmail ?? 'User'
  const letter    = display[0]?.toUpperCase() ?? '?'

  return (
    <div className="dash-page" style={{ padding: '40px 40px', maxWidth: 760 }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Settings</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Manage your account.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Profile */}
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profile</span>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#4b6bff,#9b6bff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {letter}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</p>
                {userEmail && userName && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Plan / Billing — drop NEXT_PUBLIC_CHECKOUT_URL (Stripe Payment Link,
            LemonSqueezy, or Paddle) to turn the button into a real checkout. */}
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plan</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Starter · Free</p>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>Upgrade to Pro for unlimited threads and full AI analysis.</p>
            </div>
            <a
              href={process.env.NEXT_PUBLIC_CHECKOUT_URL || '/pricing'}
              className="btn-primary"
              style={{ fontSize: 13.5, padding: '9px 18px', textDecoration: 'none', flexShrink: 0 }}
            >
              Upgrade to Pro — $39/mo
            </a>
          </div>
        </div>

        {/* Account */}
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account</span>
          </div>
          <div style={{ padding: '6px 8px' }}>
            <SignOutButton />
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 4 }}>Velnox · Early Access</p>
      </div>
    </div>
  )
}
