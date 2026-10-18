'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlayCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { DrillLibrary } from '@/components/drills/drill-library';

export default function DrillsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2">Drill Library</h1>
          <p className="text-text-secondary">
            Build and organize your collection of training drills
          </p>
        </div>
        <Link
          href="/dashboard/drills/animations"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <PlayCircle className="h-4 w-4 text-accent" aria-hidden="true" />
          Animated drills
        </Link>
      </div>

      <DrillLibrary />
    </div>
  );
}
