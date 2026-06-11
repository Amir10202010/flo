import type { Metadata } from 'next'
import LegalLayout, { LegalSection, P, UL, LI, Strong } from '@/components/marketing/LegalLayout'

const UPDATED = 'June 11, 2026'
const CONTACT_EMAIL = 'sagindiktar@gmail.com'

export const metadata: Metadata = {
  title: 'Terms of Service — Velnox',
  description:
    'The terms that govern your use of Velnox, the AI-powered Gmail assistant that syncs, analyzes, and prioritizes your client conversations.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service — Velnox',
    description:
      'The terms that govern your use of Velnox, the AI-powered Gmail assistant that syncs, analyzes, and prioritizes your client conversations.',
    url: '/terms',
    siteName: 'Velnox',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service — Velnox',
    description: 'The terms that govern your use of Velnox, the AI-powered Gmail assistant for client conversations.',
  },
}

const SECTIONS = [
  { id: 'acceptance', label: 'Acceptance of terms' },
  { id: 'service', label: 'Description of the service' },
  { id: 'accounts', label: 'User accounts' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'google', label: 'Google and third-party services' },
  { id: 'ai-disclaimer', label: 'AI-generated content' },
  { id: 'ip', label: 'Intellectual property' },
  { id: 'payments', label: 'Payments and subscriptions' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'termination', label: 'Termination' },
  { id: 'changes', label: 'Changes to these terms' },
  { id: 'governing-law', label: 'Governing law' },
  { id: 'contact', label: 'Contact us' },
]

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      intro="These terms govern your use of Velnox. Please read them carefully — by creating an account or connecting Gmail, you agree to them."
      updated={UPDATED}
      sections={SECTIONS}
    >
      <LegalSection id="acceptance" title="Acceptance of terms">
        <P>
          These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement between you and Velnox (&ldquo;Velnox,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) governing your access to and use of the Velnox website and
          application (the &ldquo;Service&rdquo;). By creating an account, connecting your Gmail, or otherwise using the Service,
          you agree to be bound by these Terms and by our{' '}
          <a href="/privacy" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Privacy Policy
          </a>
          . If you are using the Service on behalf of an organization, you represent that you are authorized to accept these Terms
          on its behalf.
        </P>
      </LegalSection>

      <LegalSection id="service" title="Description of the service">
        <P>
          Velnox is an AI-powered email assistant. When you connect Gmail through Google OAuth, Velnox syncs your client
          conversations, analyzes them to assign priority and risk, generates summaries and suggested replies, can send replies in
          your Gmail threads at your direction, and surfaces productivity insights about your inbox. The Service is provided on an
          ongoing basis and may evolve over time as we add, change, or remove features.
        </P>
      </LegalSection>

      <LegalSection id="accounts" title="User accounts">
        <UL>
          <LI>You must provide accurate information when creating an account and keep it up to date.</LI>
          <LI>
            You are responsible for safeguarding your account credentials and for all activity that occurs under your account.
          </LI>
          <LI>You must be at least 18 years old to use the Service.</LI>
          <LI>
            You are responsible for ensuring you have the right to connect any Gmail account you link to Velnox and to process the
            communications within it.
          </LI>
          <LI>Notify us promptly at the contact address below if you suspect unauthorized use of your account.</LI>
        </UL>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use">
        <P>You agree not to, and not to allow anyone else to:</P>
        <UL>
          <LI>Use the Service for any unlawful, fraudulent, or harmful purpose, or to violate the rights of others.</LI>
          <LI>Send spam, unsolicited bulk messages, or otherwise misuse the reply features.</LI>
          <LI>
            Attempt to access accounts, data, or conversations that do not belong to you, or to bypass security or access
            controls.
          </LI>
          <LI>
            Reverse engineer, decompile, scrape, or attempt to extract the source code or underlying models of the Service, except
            to the extent permitted by law.
          </LI>
          <LI>
            Introduce malware, overload or disrupt our infrastructure, or interfere with other users&rsquo; use of the Service.
          </LI>
          <LI>
            Use the Service in a way that violates Google&rsquo;s terms or the applicable terms of any connected third-party
            service.
          </LI>
        </UL>
        <P>We may suspend or terminate access for conduct that we reasonably believe violates these Terms or harms others.</P>
      </LegalSection>

      <LegalSection id="google" title="Google and third-party services">
        <P>
          The Service integrates with Google Gmail and other third-party providers. Your use of those services through Velnox is
          also subject to their respective terms and policies, including the Google Terms of Service. You grant Velnox permission
          to access and process your Gmail data solely to provide the features described in these Terms, consistent with our
          Privacy Policy and the Google API Services User Data Policy. You may revoke this access at any time from your Google
          Account permissions, which will disable the affected features.
        </P>
      </LegalSection>

      <LegalSection id="ai-disclaimer" title="AI-generated content">
        <P>
          Velnox uses AI to produce summaries, priority and risk assessments, and suggested replies. This output may be
          inaccurate, incomplete, or not appropriate for a given situation. You are responsible for reviewing AI-generated content
          before relying on it or sending it, and Velnox is not liable for decisions you make based on it. Suggested replies are
          only sent when you explicitly choose to send them.
        </P>
      </LegalSection>

      <LegalSection id="ip" title="Intellectual property">
        <P>
          The Service, including its software, design, branding, and content we create, is owned by Velnox and protected by
          intellectual property laws. We grant you a limited, non-exclusive, non-transferable, revocable license to use the
          Service in accordance with these Terms.
        </P>
        <P>
          <Strong>Your content.</Strong> You retain all rights to your emails, conversations, and other data you bring to the
          Service (&ldquo;Your Content&rdquo;). You grant Velnox a limited license to host, process, and display Your Content
          solely as needed to operate and provide the Service to you. We claim no ownership over Your Content.
        </P>
      </LegalSection>

      <LegalSection id="payments" title="Payments and subscriptions">
        <P>
          Velnox may offer free and paid plans. Paid subscriptions (for example, Velnox Pro) are billed in advance on a recurring
          basis through our third-party payment processor at the price and interval shown at checkout. By subscribing, you
          authorize us and our payment processor to charge your chosen payment method for the applicable fees.
        </P>
        <UL>
          <LI>Subscriptions renew automatically until cancelled. You can cancel at any time, effective at the end of the current billing period.</LI>
          <LI>
            Except where required by law, fees are non-refundable and we do not provide refunds or credits for partial periods or
            unused features.
          </LI>
          <LI>We may change pricing or plan features with reasonable advance notice; changes apply to subsequent billing periods.</LI>
          <LI>You are responsible for any applicable taxes.</LI>
        </UL>
        <P>If a feature or plan is offered for free or in beta, we may modify or discontinue it at any time.</P>
      </LegalSection>

      <LegalSection id="disclaimers" title="Disclaimers">
        <P>
          The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind,
          whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, and
          non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or secure, that AI output will be
          accurate, or that the Service will meet your specific requirements.
        </P>
      </LegalSection>

      <LegalSection id="liability" title="Limitation of liability">
        <P>
          To the maximum extent permitted by law, Velnox and its operators will not be liable for any indirect, incidental,
          special, consequential, or punitive damages, or for any loss of profits, revenue, data, goodwill, or business
          opportunities, arising out of or relating to your use of (or inability to use) the Service, even if we have been advised
          of the possibility of such damages.
        </P>
        <P>
          To the maximum extent permitted by law, our total aggregate liability for any claim relating to the Service is limited to
          the greater of (a) the amount you paid us for the Service in the twelve months before the event giving rise to the claim,
          or (b) USD 100. Some jurisdictions do not allow certain limitations, so some of the above may not apply to you.
        </P>
      </LegalSection>

      <LegalSection id="termination" title="Termination">
        <P>
          You may stop using the Service and close your account at any time, including by disconnecting Gmail. We may suspend or
          terminate your access if you violate these Terms, if required by law, or if necessary to protect the Service or other
          users. Upon termination, your right to use the Service ends and we will delete or de-identify your synced data as
          described in our Privacy Policy, except where retention is required by law. Sections that by their nature should survive
          termination — including intellectual property, disclaimers, and limitation of liability — will continue to apply.
        </P>
      </LegalSection>

      <LegalSection id="changes" title="Changes to these terms">
        <P>
          We may update these Terms from time to time. When we make material changes, we will update the &ldquo;Last updated&rdquo;
          date above and, where appropriate, notify you within the Service. Your continued use of Velnox after changes take effect
          constitutes acceptance of the revised Terms. If you do not agree, please stop using the Service.
        </P>
      </LegalSection>

      <LegalSection id="governing-law" title="Governing law">
        <P>
          These Terms are governed by and construed in accordance with applicable law, without regard to conflict-of-laws
          principles. Any disputes arising from these Terms or the Service will be resolved in the competent courts of the
          jurisdiction in which Velnox operates, except where mandatory local law grants you the right to bring a claim elsewhere.
        </P>
      </LegalSection>

      <LegalSection id="contact" title="Contact us">
        <P>
          Questions about these Terms? Contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            {CONTACT_EMAIL}
          </a>
          .
        </P>
      </LegalSection>
    </LegalLayout>
  )
}
