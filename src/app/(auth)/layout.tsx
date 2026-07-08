import Brand from '@/components/layout/Brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // The "already signed in → redirect" guard lives in the login/signup pages
  // (not here), so recovery flows like /reset-password — which legitimately
  // carry a session — aren't bounced away before the user can act.
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
      }}
    >
      <header style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 62, display: 'flex', alignItems: 'center' }}>
          <Brand size={24} />
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        {children}
      </div>
    </div>
  )
}
