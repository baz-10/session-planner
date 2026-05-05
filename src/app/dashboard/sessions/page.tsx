'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { SessionsList } from '@/components/sessions/sessions-list';
import { MobileHeader, MobileLoadingState, MobilePageShell } from '@/components/mobile';

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
    return <MobileLoadingState label="Loading sessions" />;
  }

  if (!user) {
    return null;
  }

  return (
    <MobilePageShell>
      <MobileHeader
        title="Sessions"
        subtitle="Create and manage practice plans"
        trailing={
          canCreateSessions ? (
            <Link
              href="/dashboard/sessions/new"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white shadow-[0_10px_24px_rgba(20,184,166,0.24)]"
              aria-label="New session"
            >
              <Plus className="h-6 w-6" />
            </Link>
          ) : undefined
        }
      />

      <div className="mb-5 hidden items-center justify-between md:flex">
        {canCreateSessions ? (
          <Link href="/dashboard/sessions/new" className="btn-accent">
            <Plus className="h-5 w-5" />
            New Session
          </Link>
        ) : (
          <span className="text-sm text-text-muted">
            Coach/Admin role required to create sessions
          </span>
        )}
      </div>

      <SessionsList />
    </MobilePageShell>
  );
}
