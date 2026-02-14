'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { SessionsList } from '@/components/sessions/sessions-list';

export default function SessionsPage() {
  const { user, isLoading, currentTeam, teamMemberships } = useAuth();
  const router = useRouter();
  const currentMembership = teamMemberships.find((membership) => membership.team.id === currentTeam?.id);
  const canCreateSessions = currentMembership?.role === 'coach' || currentMembership?.role === 'admin';

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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2">Practice Plans</h1>
          <p className="text-text-secondary">
            Create and manage your training sessions
          </p>
        </div>
        {canCreateSessions ? (
          <Link href="/dashboard/sessions/new" className="btn-accent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Session
          </Link>
        ) : (
          <span className="text-sm text-text-muted">
            Coach/Admin role required to create sessions
          </span>
        )}
      </div>

      <SessionsList />
    </div>
  );
}
