import Link from 'next/link';

const sections = [
  {
    title: 'What this covers',
    body: [
      'Session Planner is a beta team-management and practice-planning app for invited coaches, players, parents, and organization admins.',
      'This notice describes the data used to run the beta service. It should be reviewed before broader public launch.',
    ],
  },
  {
    title: 'Data we handle',
    body: [
      'Account and profile details such as name, email address, role, team membership, and organization membership.',
      'Team information entered by coaches or admins, including rosters, linked parent/player details, session plans, drills, events, attendance, RSVPs, messages, and attachments.',
      'Operational data needed for authentication, security, diagnostics, and service reliability.',
    ],
  },
  {
    title: 'How the data is used',
    body: [
      'To authenticate users, route invited members to the right team, support team communication, manage practice plans, and keep event and attendance records available to authorized team members.',
      'To protect access to team-scoped data, investigate issues, and improve the beta experience.',
    ],
  },
  {
    title: 'Team responsibility',
    body: [
      'Coaches and organization admins are responsible for inviting the right people, managing team access, and keeping roster information appropriate for their team.',
      'Avoid uploading sensitive medical, financial, or identity documents unless the team has confirmed it is necessary and appropriate.',
    ],
  },
  {
    title: 'Service providers',
    body: [
      'The beta app uses hosted infrastructure and services for authentication, database storage, file storage, deployment, and optional billing flows.',
      'OAuth providers may be used when a user signs in with Google or Apple.',
    ],
  },
  {
    title: 'Access, correction, and support',
    body: [
      'For beta access, roster changes, team removal, or message/content questions, contact your coach or organization admin first.',
      'Organization admins should escalate app-level issues through the beta operator until public support channels are finalized.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-whisper">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <Link href="/" className="text-sm font-semibold text-teal hover:text-teal-dark">
          Back to Session Planner
        </Link>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-border md:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal">
            Beta Privacy Notice
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-navy md:text-5xl">
            Privacy Notice
          </h1>
          <p className="mt-4 text-sm text-text-muted">Last updated May 11, 2026</p>
          <p className="mt-6 text-lg leading-8 text-text-secondary">
            Session Planner is being prepared for invited beta teams. This notice explains
            the practical data handling expectations for the beta.
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
            This beta notice is intentionally plain-language. Final public privacy,
            support, and data retention language should be reviewed before a broader rollout.
          </div>
        </div>
      </div>
    </main>
  );
}
