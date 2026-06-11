import type { Metadata } from 'next'
import LegalLayout, { LegalSection, P, UL, LI, Strong } from '@/components/marketing/LegalLayout'

const UPDATED = 'June 11, 2026'
const CONTACT_EMAIL = 'sagindiktar@gmail.com'

export const metadata: Metadata = {
  title: 'Privacy Policy — Velnox',
  description:
    'How Velnox collects, uses, and protects your data when you connect Gmail and analyze client conversations with AI. Read our full privacy policy.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy — Velnox',
    description:
      'How Velnox collects, uses, and protects your data when you connect Gmail and analyze client conversations with AI.',
    url: '/privacy',
    siteName: 'Velnox',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy — Velnox',
    description: 'How Velnox collects, uses, and protects your data when you connect Gmail and analyze client conversations with AI.',
  },
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'information-we-collect', label: 'Information we collect' },
  { id: 'how-we-use', label: 'How we use your data' },
  { id: 'ai-processing', label: 'AI processing of email content' },
  { id: 'cookies', label: 'Cookies and analytics' },
  { id: 'third-parties', label: 'Third-party services' },
  { id: 'data-retention', label: 'Data retention' },
  { id: 'security', label: 'How we protect your data' },
  { id: 'your-rights', label: 'Your rights and choices' },
  { id: 'google-data', label: 'Google API limited use' },
  { id: 'international', label: 'International transfers' },
  { id: 'children', label: "Children's privacy" },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact us' },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      intro="Velnox connects to your Gmail to sort and analyze client conversations. This policy explains exactly what we collect, why, and the control you have over it."
      updated={UPDATED}
      sections={SECTIONS}
    >
      <LegalSection id="overview" title="Overview">
        <P>
          Velnox (&ldquo;Velnox,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides an AI-powered email
          assistant that connects to your Google Gmail account, syncs your conversations, analyzes them to assign priority and
          risk, generates summaries and suggested replies, and surfaces productivity insights. This Privacy Policy describes how
          we collect, use, store, share, and protect information when you use our website and application (the
          &ldquo;Service&rdquo;).
        </P>
        <P>
          By creating an account or connecting your Gmail to Velnox, you agree to the practices described in this policy. If you
          do not agree, please do not use the Service.
        </P>
      </LegalSection>

      <LegalSection id="information-we-collect" title="Information we collect">
        <P>We collect the following categories of information:</P>
        <UL>
          <LI>
            <Strong>Account information.</Strong> When you sign up, we collect your name, email address, and authentication
            credentials managed through our authentication provider (Supabase). If you sign in with Google, we receive your basic
            Google profile (name, email address, and profile picture).
          </LI>
          <LI>
            <Strong>Gmail content and metadata.</Strong> When you connect Gmail through Google OAuth, we access the messages and
            threads in your inbox so the Service can function. This includes message senders and recipients, subject lines,
            message bodies, timestamps, thread identifiers, and Gmail history identifiers used for incremental syncing. We sync up
            to your recent inbox conversations and store them in our database to power your prioritized inbox.
          </LI>
          <LI>
            <Strong>OAuth tokens.</Strong> We store the access and refresh tokens that authorize Velnox to reach the Gmail API on
            your behalf. These tokens are encrypted at rest.
          </LI>
          <LI>
            <Strong>AI-generated data.</Strong> Analysis we derive from your conversations — priority scores, risk levels,
            sentiment, summaries, and suggested replies — is stored alongside the relevant conversation.
          </LI>
          <LI>
            <Strong>Usage and device data.</Strong> Like most web applications, we automatically receive standard log data such as
            IP address, browser type, pages visited, and timestamps when you interact with the Service.
          </LI>
        </UL>
        <P>
          We do <Strong>not</Strong> ask for or store your Google account password. Access is granted exclusively through
          Google&rsquo;s secure OAuth consent flow, which you can revoke at any time.
        </P>
      </LegalSection>

      <LegalSection id="how-we-use" title="How we use your data">
        <P>We use the information we collect to:</P>
        <UL>
          <LI>Authenticate you and maintain your account.</LI>
          <LI>Sync, display, and organize your client conversations within your prioritized inbox.</LI>
          <LI>Run AI analysis that assigns priority and risk, detects conversations going cold, and drafts suggested replies.</LI>
          <LI>Send replies in your Gmail threads when you explicitly choose to do so.</LI>
          <LI>Generate productivity insights, analytics, and relationship-health metrics for your own workspace.</LI>
          <LI>Maintain the security, reliability, and performance of the Service, and diagnose technical issues.</LI>
          <LI>Communicate with you about your account, important changes, and support requests.</LI>
        </UL>
        <P>
          We do <Strong>not</Strong> sell your personal information or your email content, and we do not use the content of your
          emails for advertising or to train generally available AI models.
        </P>
      </LegalSection>

      <LegalSection id="ai-processing" title="AI processing of email content">
        <P>
          To analyze your conversations, the relevant message content is sent to our AI provider, Google&rsquo;s Gemini API, which
          returns the analysis (priority, risk, sentiment, summaries, and suggested replies). This processing happens only to
          provide features within your own workspace.
        </P>
        <P>
          Email content processed through the Gemini API is handled under Google&rsquo;s applicable API terms and is not used to
          train Google&rsquo;s generally available models when accessed via the paid API tier. We send only the data needed to
          perform the requested analysis.
        </P>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies and analytics">
        <P>
          We use strictly necessary cookies to keep you signed in and to maintain your session securely. These include the
          authentication and session cookies set by our authentication provider, as well as a short-lived state cookie used to
          protect the Gmail connection flow against cross-site request forgery.
        </P>
        <P>
          We may use privacy-respecting, aggregate analytics to understand how the Service is used and to improve it. Where
          analytics are used, they are limited to product usage signals and do not include the content of your emails. You can
          control non-essential cookies through your browser settings; disabling strictly necessary cookies may prevent the
          Service from functioning.
        </P>
      </LegalSection>

      <LegalSection id="third-parties" title="Third-party services">
        <P>
          We rely on a small set of trusted infrastructure providers (sub-processors) to operate the Service. Each receives only
          the data needed to perform its function:
        </P>
        <UL>
          <LI>
            <Strong>Google (Gmail API &amp; OAuth).</Strong> Provides email sync, message sending, and sign-in. Governed by
            Google&rsquo;s Privacy Policy.
          </LI>
          <LI>
            <Strong>Google Gemini API.</Strong> Performs the AI analysis of conversation content.
          </LI>
          <LI>
            <Strong>Supabase.</Strong> Provides authentication and our managed PostgreSQL database where your data is stored.
          </LI>
          <LI>
            <Strong>Vercel.</Strong> Hosts and serves the application.
          </LI>
        </UL>
        <P>
          We do not share your personal information with third parties for their own marketing. We may disclose information if
          required by law, to enforce our agreements, or to protect the rights, safety, and security of our users and the Service.
        </P>
      </LegalSection>

      <LegalSection id="data-retention" title="Data retention">
        <P>
          We retain your account information and synced conversation data for as long as your account is active and you keep Gmail
          connected, so the Service can continue to function. When you disconnect Gmail, delete a conversation, or close your
          account, we delete the associated synced messages, analysis, and stored OAuth tokens within a reasonable period, except
          where we are required to retain certain records to comply with legal obligations or resolve disputes.
        </P>
        <P>
          You can request deletion of your data at any time by disconnecting your integration or contacting us at the address
          below.
        </P>
      </LegalSection>

      <LegalSection id="security" title="How we protect your data">
        <P>We apply technical and organizational safeguards designed to protect your information, including:</P>
        <UL>
          <LI>Encryption of your Google OAuth tokens at rest using AES-256-GCM.</LI>
          <LI>Encryption in transit (HTTPS/TLS) for all data moving between your browser, our servers, and our providers.</LI>
          <LI>Scoped, owner-checked access so users can only reach their own conversations and integrations.</LI>
          <LI>Use of reputable, security-conscious infrastructure providers.</LI>
        </UL>
        <P>
          No method of transmission or storage is completely secure, so while we work hard to protect your information we cannot
          guarantee absolute security.
        </P>
      </LegalSection>

      <LegalSection id="your-rights" title="Your rights and choices">
        <P>Depending on your location, you may have the right to:</P>
        <UL>
          <LI>Access the personal information we hold about you.</LI>
          <LI>Correct inaccurate information.</LI>
          <LI>Delete your information (the &ldquo;right to be forgotten&rdquo;).</LI>
          <LI>Withdraw consent and disconnect Gmail at any time, which stops further syncing.</LI>
          <LI>Object to or restrict certain processing, and request a copy of your data in a portable format.</LI>
        </UL>
        <P>
          You can disconnect Gmail from the Integrations area of the app, and you can revoke Velnox&rsquo;s access directly from
          your{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
          >
            Google Account permissions
          </a>
          . To exercise any of these rights, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            {CONTACT_EMAIL}
          </a>
          .
        </P>
      </LegalSection>

      <LegalSection id="google-data" title="Google API limited use">
        <P>
          Velnox&rsquo;s use and transfer of information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements. Specifically, we only use Google user data to provide and improve
          user-facing features of Velnox; we do not transfer or sell this data for advertising, and we do not use it for any
          purpose unrelated to the Service. Humans do not read your Gmail data except where you explicitly request support, where
          required for security or to comply with the law, or in aggregated, anonymized form.
        </P>
      </LegalSection>

      <LegalSection id="international" title="International transfers">
        <P>
          Velnox is operated with infrastructure that may process and store data in countries other than your own, including the
          United States. Where data is transferred internationally, we rely on appropriate safeguards and our providers&rsquo;
          compliance frameworks to protect it consistent with this policy.
        </P>
      </LegalSection>

      <LegalSection id="children" title="Children's privacy">
        <P>
          Velnox is a business productivity tool intended for users aged 18 and over. It is not directed to children, and we do
          not knowingly collect personal information from anyone under 18. If you believe a child has provided us information,
          contact us and we will delete it.
        </P>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <P>
          We may update this Privacy Policy from time to time. When we make material changes, we will update the &ldquo;Last
          updated&rdquo; date above and, where appropriate, notify you within the Service. Your continued use of Velnox after an
          update means you accept the revised policy.
        </P>
      </LegalSection>

      <LegalSection id="contact" title="Contact us">
        <P>
          If you have questions about this Privacy Policy or how we handle your data, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            {CONTACT_EMAIL}
          </a>
          .
        </P>
      </LegalSection>
    </LegalLayout>
  )
}
