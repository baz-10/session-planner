'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { SessionBuilder } from '@/components/sessions/session-builder';

export default function NewSessionPage() {
  const { user, isLoading, currentTeam, teamMemberships } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Log auth state for debugging
  useEffect(() => {
    console.log('[NewSessionPage] Auth state:', {
      isLoading,
      hasUser: !!user,
      hasCurrentTeam: !!currentTeam,
      teamId: currentTeam?.id,
      numTeamMemberships: teamMemberships?.length || 0,
    });
  }, [isLoading, user, currentTeam, teamMemberships]);

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

  // Show message if no team is selected
  if (!currentTeam) {
    return (
      <div className="p-8">
        <div className="card p-8 text-center">
          <h2 className="text-xl font-semibold text-navy mb-2">No Team Selected</h2>
          <p className="text-text-secondary mb-4">
            You need to be part of a team to create sessions.
          </p>
          <Link href="/dashboard/team" className="btn-primary">
            Go to Team Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link href="/dashboard" className="text-text-secondary hover:text-teal transition-colors">
          Dashboard
        </Link>
        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href="/dashboard/sessions" className="text-text-secondary hover:text-teal transition-colors">
          Sessions
        </Link>
        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-navy font-medium">New Plan</span>
      </nav>

      <SessionBuilder isNew />
    </div>
  );
}
