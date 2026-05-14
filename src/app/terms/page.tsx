import Link from 'next/link';

const sections = [
  {
    title: 'Beta access',
    body: [
      'Session Planner beta access is intended for invited teams, organizations, and their authorized members.',
      'Do not share invite links or access codes outside the team or organization they were created for.',
    ],
  },
  {
    title: 'Account and role responsibilities',
    body: [
      'Use accurate account information and choose the role that best matches how you participate in the team.',
      'Coaches and organization admins are responsible for member invites, role changes, roster accuracy, and removing people who should no longer have access.',
    ],
  },
  {
    title: 'Team content',
    body: [
      'Only upload or post content that is appropriate for your team and that you have permission to share.',
      'Avoid uploading sensitive medical, financial, or identity documents during beta unless your team has confirmed it is necessary and appropriate.',
      'Team chat, posts, attachments, practice plans, events, RSVPs, and attendance records should be used for legitimate team operations.',
    ],
  },
  {
    title: 'Acceptable use',
    body: [
      'Do not use the service to harass others, share unlawful content, attempt to access another team without permission, interfere with the app, or bypass security controls.',
      'Report suspected access mistakes or inappropriate content to your coach or organization admin.',
    ],
  },
  {
    title: 'Billing and payments',
    body: [
      'Some billing and payment-reminder features may be available during beta. Teams should verify amounts, recipients, and payment status before relying on those records.',
      'Payment provider terms may also apply if a payment flow is enabled.',
    ],
  },
  {
    title: 'Availability and changes',
    body: [
      'The beta service may change as features are tested, fixed, or removed.',
      'Session Planner should not be the only place a team stores critical emergency, medical, or compliance records.',
    ],
  },
  {
    title: 'Support',
    body: [
      'Beta users should contact their coach or organization admin first for invite, roster, role, or content issues.',
      'Organization admins should escalate app-level issues through the beta operator until public support channels are finalized.',
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-whisper">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <Link href="/" className="text-sm font-semibold text-teal hover:text-teal-dark">
          Back to Session Planner
        </Link>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-border md:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal">
            Beta Terms
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-navy md:text-5xl">
            Terms of Use
          </h1>
          <p className="mt-4 text-sm text-text-muted">Last updated May 11, 2026</p>
          <p className="mt-6 text-lg leading-8 text-text-secondary">
            These beta terms set practical expectations for invited Session Planner users
            while the app is being prepared for broader rollout.
          </p>

          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-bold text-navy">{section.title}</h2>
                <div className="mt-3 space-y-3 text-base leading-7 text-text-secondary">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-xl bg-teal-glow p-5 text-sm leading-6 text-teal-dark">
            These beta terms are a rollout baseline. Final public legal terms should be
            reviewed before a broader public launch.
          </div>
        </div>
      </div>
    </main>
  );
}
