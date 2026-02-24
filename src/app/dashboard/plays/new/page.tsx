'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { PlayEditorShell } from '@/components/plays/play-editor-shell';

export default function NewPlayPage() {
  const router = useRouter();
  const { user, isLoading, currentTeam, teamMemberships } = useAuth();

  const membership = teamMemberships.find((item) => item.team.id === currentTeam?.id);
  const canCreate = membership?.role === 'coach' || membership?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  if (!canCreate) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Coach/Admin access required</h2>
          <p className="text-gray-600 mb-4">
            You can view plays, but only coaches/admins can create or edit them.
          </p>
          <Link href="/dashboard/plays" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light">
            Back to Plays
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:text-primary">Dashboard</Link>
        <span className="text-gray-400">/</span>
        <Link href="/dashboard/plays" className="text-gray-500 hover:text-primary">Plays</Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">New Play</span>
      </nav>

      <PlayEditorShell />
    </div>
  );
}
