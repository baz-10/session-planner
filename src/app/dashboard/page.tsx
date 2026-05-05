'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock3,
  CreditCard,
  MessageCircle,
  PieChart,
  PlayCircle,
  Plus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useBranding } from '@/hooks/use-branding';
import { useDrills } from '@/hooks/use-drills';
import { useEvents } from '@/hooks/use-events';
import { useSessions } from '@/hooks/use-sessions';
import { useTeam } from '@/hooks/use-team';
import {
  MobileActionCard,
  MobileEmptyState,
  MobileListCard,
  MobileLoadingState,
  MobilePageShell,
  MobileStatCard,
} from '@/components/mobile';
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
  const { displayName, logoUrl } = useBranding();
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
    return <MobileLoadingState label="Loading dashboard" />;
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <MobilePageShell>
      <header className="mb-6 flex items-center gap-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy text-white shadow-[0_14px_32px_rgba(15,31,51,0.15)]">
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <ClipboardList className="h-9 w-9" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[25px] font-extrabold leading-tight text-navy md:text-3xl">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Coach'}
          </h1>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-[17px] font-medium text-slate-500">
            <span className="truncate">{currentTeam?.name || 'Select a team'}</span>
            <ChevronRight className="h-4 w-4 rotate-90" />
          </div>
        </div>
        <Link
          href="/dashboard/feed"
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6" />
          <span className="absolute right-2 top-2 h-3 w-3 rounded-full border-2 border-white bg-teal" />
        </Link>
      </header>

      <section className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        <MobileStatCard
          icon={<CalendarCheck className="h-7 w-7" />}
          label="Upcoming"
          value={isDashboardLoading ? '...' : snapshot.sessionsThisWeek}
          caption={`${snapshot.totalSessions} total`}
          tone="blue"
        />
        <MobileStatCard
          icon={<Users className="h-7 w-7" />}
          label="Team Members"
          value={isDashboardLoading ? '...' : snapshot.teamMembers}
          caption={`${snapshot.activePlayers} players`}
          tone="teal"
        />
        <MobileStatCard
          icon={<ClipboardList className="h-7 w-7" />}
          label="Drill Library"
          value={isDashboardLoading ? '...' : snapshot.drillCount}
          caption="Drills"
          tone="violet"
        />
        <MobileStatCard
          icon={<PieChart className="h-7 w-7" />}
          label="Attendance"
          value={
            isDashboardLoading
              ? '...'
              : snapshot.attendanceRate === null
                ? '-'
                : `${snapshot.attendanceRate}%`
          }
          caption="Team Avg."
          tone="teal"
        />
      </section>

      <section className="mb-7">
        <h2 className="mb-4 text-[23px] font-extrabold text-navy">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          <MobileActionCard
            href="/dashboard/sessions/new"
            icon={<Plus className="h-8 w-8" />}
            label="New Session"
          />
          <MobileActionCard
            href="/dashboard/events"
            icon={<CalendarDays className="h-7 w-7" />}
            label="Schedule Event"
          />
          <MobileActionCard
            href="/dashboard/chat"
            icon={<MessageCircle className="h-7 w-7" />}
            label="Team Chat"
          />
          <MobileActionCard
            href="/dashboard/billing"
            icon={<CreditCard className="h-7 w-7" />}
            label="Billing"
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[23px] font-extrabold text-navy">Recent Sessions</h2>
          <Link
            href="/dashboard/sessions"
            className="inline-flex items-center gap-1 text-sm font-extrabold text-teal"
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {isDashboardLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <MobileListCard key={item}>
                <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
              </MobileListCard>
            ))}
          </div>
        ) : snapshot.recentSessions.length > 0 ? (
          <div className="space-y-3">
            {snapshot.recentSessions.map((session) => (
              <MobileListCard key={session.id} className="space-y-4">
                <div className="flex items-center gap-4">
                  <Link
                    href={`/dashboard/sessions/${session.id}`}
                    className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-teal-light shadow-[0_14px_28px_rgba(15,31,51,0.12)]"
                    aria-label={`Open ${session.name}`}
                  >
                    <ClipboardList className="h-9 w-9" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/sessions/${session.id}`}
                      className="line-clamp-2 text-[17px] font-extrabold leading-5 text-navy transition-colors hover:text-teal"
                    >
                      {session.name}
                    </Link>
                    <div className="mt-2 grid gap-x-3 gap-y-1 text-[13px] font-medium text-slate-500 sm:grid-cols-2">
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
                      {session.location && <span className="truncate">{session.location}</span>}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/sessions/${session.id}/run`}
                    className="hidden min-h-11 shrink-0 items-center justify-center rounded-2xl border border-teal px-4 text-sm font-extrabold text-teal transition-colors hover:bg-accent/5 sm:inline-flex"
                  >
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Run live
                  </Link>
                </div>
                <Link
                  href={`/dashboard/sessions/${session.id}/run`}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-teal text-base font-extrabold text-teal transition-colors active:scale-[0.98] sm:hidden"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Run live
                </Link>
              </MobileListCard>
            ))}
          </div>
        ) : (
          <MobileEmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="No sessions yet"
            description="Create your first practice plan to get started."
            action={
              <Link href="/dashboard/sessions/new" className="btn-accent">
                Create Session
              </Link>
            }
          />
        )}
      </section>
    </MobilePageShell>
  );
}
