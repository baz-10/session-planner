import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DrillAnimationPlayer } from '@/components/drills/drill-animation';
import { DRILL_ANIMATIONS, getDrillAnimation } from '@/lib/drill-animations';

export function generateStaticParams() {
  return DRILL_ANIMATIONS.map((drill) => ({ slug: drill.slug }));
}

interface DrillAnimationPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DrillAnimationPage({ params }: DrillAnimationPageProps) {
  const { slug } = await params;
  const drill = getDrillAnimation(slug);
  if (!drill) notFound();

  const facts = [
    { label: 'Players', value: drill.playerCount },
    { label: 'Time', value: drill.time },
    { label: 'Level', value: drill.level },
    { label: 'Equipment', value: drill.equipment },
  ];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <Link href="/dashboard/drills/animations" className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Animated Drills
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold text-navy">{drill.name}</h1>
          <Badge variant="accent">{drill.category}</Badge>
        </div>
        <p className="mt-2 max-w-3xl text-text-secondary">{drill.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {drill.focus.map((f) => (
            <Badge key={f} variant="secondary">
              {f}
            </Badge>
          ))}
        </div>
      </div>

      <DrillAnimationPlayer drill={drill} />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{fact.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-900">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Setup">
          <ul className="list-disc space-y-1 pl-5">
            {drill.setup.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
        <Section title="How it runs">
          <ol className="list-decimal space-y-1 pl-5">
            {drill.howItRuns.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Section>
        {drill.coachingPoints.map((group) => (
          <Section key={group.title} title={`Coaching points: ${group.title}`}>
            <ul className="list-disc space-y-1 pl-5">
              {group.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Section>
        ))}
        <Section title="Common mistakes">
          <ul className="list-disc space-y-1 pl-5">
            {drill.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Section>
        <Section title="Progressions">
          <ul className="list-disc space-y-1 pl-5">
            {drill.progressions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-primary">{title}</h2>
      <div className="text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}
