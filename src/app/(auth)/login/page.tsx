import AuthForm from '@/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ marginBottom: 26, textAlign: 'center' }}>
        <h1 className="display-title" style={{ fontSize: 28, margin: '0 0 8px' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
          Sign in to your Velnox workspace.
        </p>
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', boxShadow: 'var(--shadow-sm)' }}>
        <AuthForm mode="login" />
      </div>
    </div>
  )
}
