'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Clock3, PlayCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useDrills } from '@/hooks/use-drills';
import { useEvents } from '@/hooks/use-events';
import { useSessions } from '@/hooks/use-sessions';
import { useTeam } from '@/hooks/use-team';
import { formatDuration, formatTime12Hour } from '@/lib/utils/time';
import type { Session, TeamMember } from '@/types/database';

interface DashboardSnapshot {
  sessionsThisWeek: number;
  totalSessions: number;
  teamMembers: number;
  activePlayers: number;
  drillCount: number;
  attendanceRate: number | null;
  attendanceEvents: number;
  recentSessions: Session[];
}

const emptySnapshot: DashboardSnapshot = {
  sessionsThisWeek: 0,
  totalSessions: 0,
  teamMembers: 0,
  activePlayers: 0,
  drillCount: 0,
  attendanceRate: null,
  attendanceEvents: 0,
  recentSessions: [],
};

function parseSessionDate(date: string | null): Date | null {
  if (!date) return null;

  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
}

function formatSessionDate(date: string | null): string {
  const parsedDate = parseSessionDate(date);
  if (!parsedDate) return 'No date';

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const { user, profile, isLoading, currentTeam } = useAuth();
  const router = useRouter();
  const { getSessions } = useSessions();
  const { getDrills } = useDrills();
  const { getAttendanceStats } = useEvents();
  const { getTeamMembers } = useTeam();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    } else if (!isLoading && user && profile && !profile.onboarding_completed) {
      router.push('/onboarding');
    }
  }, [user, profile, isLoading, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardSnapshot() {
      if (!currentTeam?.id) {
        setSnapshot(emptySnapshot);
        setIsDashboardLoading(false);
        return;
      }

      setIsDashboardLoading(true);

      try {
        const now = new Date();
        const weekStart = startOfWeek(now);
        const weekEnd = endOfWeek(now);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

        const [sessions, drills, membersResult, attendanceStats] = await Promise.all([
          getSessions(),
          getDrills(),
          getTeamMembers(currentTeam.id),
          getAttendanceStats({ startDate: monthStart, endDate: monthEnd }),
        ]);

        if (cancelled) return;

        const teamMembers = membersResult.success ? membersResult.members || [] : [];
        const activeMembers = teamMembers.filter((member: TeamMember) => member.status !== 'inactive');
        const activePlayers = activeMembers.filter((member: TeamMember) => member.role === 'player');
        const sessionsThisWeek = sessions.filter((session) => {
          const sessionDate = parseSessionDate(session.date);
          return Boolean(sessionDate && sessionDate >= weekStart && sessionDate < weekEnd);
        }).length;

        setSnapshot({
          sessionsThisWeek,
          totalSessions: sessions.length,
          teamMembers: activeMembers.length,
          activePlayers: activePlayers.length,
          drillCount: drills.length,
          attendanceRate:
            attendanceStats.overall.totalEvents > 0
              ? attendanceStats.overall.averageAttendance
              : null,
          attendanceEvents: attendanceStats.overall.totalEvents,
          recentSessions: sessions.slice(0, 5),
        });
      } finally {
        if (!cancelled) {
          setIsDashboardLoading(false);
        }
      }
    }

    void loadDashboardSnapshot();

    return () => {
      cancelled = true;
    };
  }, [currentTeam?.id, getAttendanceStats, getDrills, getSessions, getTeamMembers]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const statValueClass = isDashboardLoading ? 'animate-pulse text-text-muted' : 'text-navy';

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Coach'}
        </h1>
        <p className="text-text-secondary">
          {currentTeam
            ? `Here's what's happening with ${currentTeam.name} today.`
            : 'Create or join a team to start planning sessions.'}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6">
          <div className="section-label">Upcoming</div>
          <div className={`stat-number ${statValueClass}`}>
            {isDashboardLoading ? '...' : snapshot.sessionsThisWeek}
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {snapshot.totalSessions} total session{snapshot.totalSessions === 1 ? '' : 's'}
          </p>
        </div>
        <div className="card p-6">
          <div className="section-label">Team Members</div>
          <div className={`stat-number ${statValueClass}`}>
            {isDashboardLoading ? '...' : snapshot.teamMembers}
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {snapshot.activePlayers} active player{snapshot.activePlayers === 1 ? '' : 's'}
          </p>
        </div>
        <div className="card p-6">
          <div className="section-label">Drill Library</div>
          <div className={`stat-number ${statValueClass}`}>
            {isDashboardLoading ? '...' : snapshot.drillCount}
          </div>
          <p className="text-sm text-text-secondary mt-1">Saved drills</p>
        </div>
        <div className="card p-6">
          <div className="section-label">Attendance</div>
          <div className={`stat-number ${isDashboardLoading ? 'animate-pulse text-text-muted' : 'text-teal'}`}>
            {isDashboardLoading
              ? '...'
              : snapshot.attendanceRate === null
                ? '-'
                : `${snapshot.attendanceRate}%`}
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {snapshot.attendanceEvents > 0
              ? `${snapshot.attendanceEvents} event${snapshot.attendanceEvents === 1 ? '' : 's'} this month`
              : 'No records this month'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-navy mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/dashboard/sessions/new" className="card card-hover p-6 group">
            <div className="w-12 h-12 bg-teal-glow rounded-lg flex items-center justify-center mb-4 group-hover:bg-teal group-hover:text-white transition-colors">
              <svg className="w-6 h-6 text-teal group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy mb-1">New Session</h3>
            <p className="text-sm text-text-secondary">Create a practice plan with timed activities</p>
          </Link>

          <Link href="/dashboard/events" className="card card-hover p-6 group">
            <div className="w-12 h-12 bg-navy/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-navy transition-colors">
              <svg className="w-6 h-6 text-navy group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy mb-1">Schedule Event</h3>
            <p className="text-sm text-text-secondary">Add a game, practice, or team event</p>
          </Link>

          <Link href="/dashboard/chat" className="card card-hover p-6 group">
            <div className="w-12 h-12 bg-navy/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-navy transition-colors">
              <svg className="w-6 h-6 text-navy group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy mb-1">Team Chat</h3>
            <p className="text-sm text-text-secondary">Message players and parents</p>
          </Link>

          <Link href="/dashboard/billing" className="card card-hover p-6 group">
            <div className="w-12 h-12 bg-navy/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-navy transition-colors">
              <svg className="w-6 h-6 text-navy group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h5M6 5h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy mb-1">Billing</h3>
            <p className="text-sm text-text-secondary">Create invoices and collect team dues</p>
          </Link>
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-navy">Recent Sessions</h2>
          <Link href="/dashboard/sessions" className="text-sm text-teal hover:text-teal-dark font-medium">
            View all
          </Link>
        </div>
        <div className="card overflow-hidden">
          {isDashboardLoading ? (
            <div className="p-6">
              <div className="h-5 w-48 animate-pulse rounded bg-whisper" />
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-14 animate-pulse rounded-lg bg-whisper" />
                ))}
              </div>
            </div>
          ) : snapshot.recentSessions.length > 0 ? (
            <div className="divide-y divide-border">
              {snapshot.recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-whisper md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/sessions/${session.id}`}
                      className="font-semibold text-navy transition-colors hover:text-teal"
                    >
                      {session.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        {formatSessionDate(session.date)}
                      </span>
                      {session.start_time && (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-4 w-4" />
                          {formatTime12Hour(session.start_time)}
                        </span>
                      )}
                      {session.duration && <span>{formatDuration(session.duration)}</span>}
                      {session.location && <span>{session.location}</span>}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/sessions/${session.id}/run`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal px-3 py-2 text-sm font-semibold text-teal transition-colors hover:bg-teal/5"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Run live
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="empty-state-icon mx-auto">
                <svg className="w-16 h-16 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-medium text-navy mt-4 mb-2">No sessions yet</h3>
              <p className="text-sm text-text-secondary mb-4">Create your first practice plan to get started</p>
              <Link href="/dashboard/sessions/new" className="btn-accent">
                Create Session
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
