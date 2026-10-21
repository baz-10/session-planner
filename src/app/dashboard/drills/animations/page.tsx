import Link from 'next/link';
import { ArrowLeft, Clock, PlayCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DrillAnimationPoster } from '@/components/drills/drill-animation';
import { DRILL_ANIMATIONS } from '@/lib/drill-animations';

export default function DrillAnimationsPage() {
  return (
    <div className="p-4 md:p-8">
      <Link href="/dashboard/drills" className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Drill Library
      </Link>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-navy">Animated Drills</h1>
        <p className="max-w-2xl text-text-secondary">
          Step-by-step animations of proven drills. Watch how each one runs, pause on the key coaching points, then take it
          to practice.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {DRILL_ANIMATIONS.map((drill) => (
          <Link
            key={drill.slug}
            href={`/dashboard/drills/animations/${drill.slug}`}
            className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="relative aspect-video bg-[#0f1f33]">
              <DrillAnimationPoster drill={drill} className="h-full w-full" />
              <span className="absolute inset-0 grid place-items-center bg-[#0f1f33]/20 opacity-0 transition-opacity group-hover:opacity-100">
                <PlayCircle className="h-12 w-12 text-white drop-shadow" aria-hidden="true" />
              </span>
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Badge variant="accent">{drill.category}</Badge>
                <span className="text-xs text-gray-500">{drill.level}</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{drill.name}</h2>
              <p className="line-clamp-2 text-sm text-gray-500">{drill.summary}</p>
              <div className="flex gap-4 pt-1 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  {drill.playerCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {drill.time}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
