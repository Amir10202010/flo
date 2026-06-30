import type { Metadata } from 'next'
import { ROLE_LABEL } from '@/lib/permissions'
import { getCurrentUser } from '@/lib/auth'
import { previewInvitation } from '@/services/members.service'
import InviteAccept from '@/components/org/InviteAccept'

export const metadata: Metadata = { title: 'Join your team — Velnox' }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [preview, user] = await Promise.all([previewInvitation(token), getCurrentUser()])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg-base)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '30px 26px',
            boxShadow: 'var(--shadow-sm)',
            textAlign: 'center',
          }}
        >
          {!preview ? (
            <>
              <h1 className="section-title" style={{ fontSize: 20, margin: '0 0 8px' }}>
                Invitation not found
              </h1>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>This invite link is invalid.</p>
            </>
          ) : !preview.valid ? (
            <>
              <h1 className="section-title" style={{ fontSize: 20, margin: '0 0 8px' }}>
                Invitation unavailable
              </h1>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                {preview.reason ?? 'This invitation can no longer be used.'}
              </p>
            </>
          ) : (
            <>
              <h1 className="section-title" style={{ fontSize: 21, margin: '0 0 8px' }}>
                Join {preview.organizationName}
              </h1>
              <p style={{ margin: '0 0 22px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                You&apos;ve been invited to <strong>{preview.organizationName}</strong> as a{' '}
                <strong>{ROLE_LABEL[preview.role]}</strong>
                {user && user.email && user.email.toLowerCase() !== preview.email.toLowerCase() && (
                  <>
                    {' '}— but this invite is for <strong>{preview.email}</strong>. Sign in with that
                    address to accept.
                  </>
                )}
                .
              </p>
              <InviteAccept token={token} signedIn={Boolean(user)} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
