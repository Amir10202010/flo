import AuthForm from '@/components/auth/AuthForm'

export default function SignupPage() {
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: '0 0 10px' }}>
          Create your account
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
          Free to start — no credit card needed.
        </p>
      </div>
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 18, padding: '32px 32px 26px', boxShadow: 'var(--shadow-md)' }}>
        <AuthForm mode="signup" />
      </div>
    </div>
  )
}
