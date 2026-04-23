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
    <div className="min-h-full bg-[#f8fafc] p-3 md:p-4">
      <PlayEditorShell />
    </div>
  );
}
