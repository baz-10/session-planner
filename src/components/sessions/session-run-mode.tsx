'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  Edit3,
  ListChecks,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  StickyNote,
  TimerReset,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSessions } from '@/hooks/use-sessions';
import { Button } from '@/components/ui/button';
import { MobileListCard, MobileStickyActionBar } from '@/components/mobile';
import {
  calculateActivityTimings,
  formatTime12Hour,
} from '@/lib/utils/time';
import type {
  ActivityGroup,
  DrillCategory,
  Session,
  SessionActivity,
} from '@/types/database';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface SessionWithActivities extends Session {
  activities: ActivityWithCategory[];
}

type RunStatus = 'ready' | 'running' | 'paused' | 'complete';

interface RunState {
  sessionId: string;
  activeIndex: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  completedActivityIds: string[];
  status: RunStatus;
  activityNotes: Record<string, string>;
  sessionNotes: string;
  updatedAt: number;
}

interface SessionRunModeProps {
  sessionId: string;
}

interface RunActivity extends ActivityWithCategory {
  plannedStartTime: string | null;
  plannedEndTime: string | null;
}

const EMPTY_RUN_STATE: Omit<RunState, 'sessionId' | 'remainingSeconds' | 'updatedAt'> = {
  activeIndex: 0,
  elapsedSeconds: 0,
  completedActivityIds: [],
  status: 'ready',
  activityNotes: {},
  sessionNotes: '',
};

const QUICK_NOTE_PROMPTS = [
  'Keep',
  'Too long',
  'Too short',
  'Player confusion',
  'Bring back next week',
] as const;

function storageKeyForSession(sessionId: string): string {
  return `session-planner:run-mode:${sessionId}`;
}

function secondsForActivity(activity?: SessionActivity | null): number {
  return Math.max(60, (Number(activity?.duration) || 0) * 60);
}

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function parseStoredRunState(value: string | null, sessionId: string): RunState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<RunState>;
    if (parsed.sessionId !== sessionId) return null;

    return {
      sessionId,
      activeIndex: Number.isFinite(parsed.activeIndex) ? Number(parsed.activeIndex) : 0,
      remainingSeconds: Number.isFinite(parsed.remainingSeconds)
        ? Number(parsed.remainingSeconds)
        : 0,
      elapsedSeconds: Number.isFinite(parsed.elapsedSeconds)
        ? Number(parsed.elapsedSeconds)
        : 0,
      completedActivityIds: Array.isArray(parsed.completedActivityIds)
        ? parsed.completedActivityIds.filter((id): id is string => typeof id === 'string')
        : [],
      status:
        parsed.status === 'running' ||
        parsed.status === 'paused' ||
        parsed.status === 'complete' ||
        parsed.status === 'ready'
          ? parsed.status
          : 'ready',
      activityNotes:
        parsed.activityNotes && typeof parsed.activityNotes === 'object'
          ? (parsed.activityNotes as Record<string, string>)
          : {},
      sessionNotes: typeof parsed.sessionNotes === 'string' ? parsed.sessionNotes : '',
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : Date.now(),
    };
  } catch {
    return null;
  }
}

function createInitialRunState(sessionId: string, activities: SessionActivity[]): RunState {
  return {
    ...EMPTY_RUN_STATE,
    sessionId,
    remainingSeconds: secondsForActivity(activities[0]),
    updatedAt: Date.now(),
  };
}

function clampRunState(state: RunState, activities: SessionActivity[]): RunState {
  const lastIndex = Math.max(activities.length - 1, 0);
  const activeIndex = Math.min(Math.max(state.activeIndex, 0), lastIndex);
  const activeActivity = activities[activeIndex];
  const completedActivityIds = state.completedActivityIds.filter((id) =>
    activities.some((activity) => activity.id === id)
  );

  return {
    ...state,
    activeIndex,
    completedActivityIds,
    remainingSeconds:
      state.status === 'complete'
        ? 0
        : state.remainingSeconds > 0
        ? state.remainingSeconds
        : secondsForActivity(activeActivity),
    status: activities.length === 0 ? 'ready' : state.status,
    updatedAt: Date.now(),
  };
}

function advanceRunState(
  state: RunState,
  activities: SessionActivity[],
  secondsToAdvance: number
): RunState {
  if (state.status !== 'running' || activities.length === 0) {
    return state;
  }

  let activeIndex = state.activeIndex;
  let remainingSeconds = state.remainingSeconds;
  let carrySeconds = Math.max(0, secondsToAdvance);
  let consumedSeconds = 0;
  let status: RunStatus = state.status;
  const completedActivityIds = new Set(state.completedActivityIds);

  while (carrySeconds > 0 && status === 'running') {
    if (carrySeconds < remainingSeconds) {
      remainingSeconds -= carrySeconds;
      consumedSeconds += carrySeconds;
      carrySeconds = 0;
      break;
    }

    carrySeconds -= remainingSeconds;
    consumedSeconds += remainingSeconds;
    const completedActivity = activities[activeIndex];
    if (completedActivity) {
      completedActivityIds.add(completedActivity.id);
    }

    if (activeIndex >= activities.length - 1) {
      activeIndex = activities.length - 1;
      remainingSeconds = 0;
      status = 'complete';
      carrySeconds = 0;
      break;
    }

    activeIndex += 1;
    remainingSeconds = secondsForActivity(activities[activeIndex]);
  }

  return {
    ...state,
    activeIndex,
    remainingSeconds,
    elapsedSeconds: state.elapsedSeconds + consumedSeconds,
    completedActivityIds: Array.from(completedActivityIds),
    status,
    updatedAt: Date.now(),
  };
}

function appendNote(existingNote: string | undefined, prompt: string): string {
  const trimmed = existingNote?.trim();
  if (!trimmed) return prompt;
  if (trimmed.toLowerCase().includes(prompt.toLowerCase())) return trimmed;
  return `${trimmed}; ${prompt}`;
}

function buildRunSummary(session: SessionWithActivities, activities: RunActivity[], state: RunState): string {
  const completed = new Set(state.completedActivityIds);
  const lines = [
    `${session.name} - Run Summary`,
    session.date ? `Date: ${session.date}` : null,
    session.location ? `Location: ${session.location}` : null,
    `Elapsed: ${formatElapsed(state.elapsedSeconds)}`,
    '',
    'Activities:',
    ...activities.map((activity, index) => {
      const status = completed.has(activity.id)
        ? 'done'
        : index === state.activeIndex && state.status !== 'complete'
          ? 'active'
          : 'pending';
      const note = state.activityNotes[activity.id]?.trim();
      return `${index + 1}. ${activity.name} (${activity.duration} min) - ${status}${
        note ? ` - ${note}` : ''
      }`;
    }),
    state.sessionNotes.trim() ? '' : null,
    state.sessionNotes.trim() ? 'Session notes:' : null,
    state.sessionNotes.trim() || null,
  ].filter((line): line is string => line !== null);

  return lines.join('\n');
}

export function SessionRunMode({ sessionId }: SessionRunModeProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { getSession } = useSessions();
  const [session, setSession] = useState<SessionWithActivities | null>(null);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      setIsLoading(true);
      const data = await getSession(sessionId);
      if (!isMounted) return;

      if (!data) {
        setSession(null);
        setRunState(null);
        setIsLoading(false);
        return;
      }

      const sortedActivities = [...(data.activities || [])].sort(
        (left, right) => left.sort_order - right.sort_order
      );
      const nextSession = { ...data, activities: sortedActivities } as SessionWithActivities;
      const storedState =
        typeof window === 'undefined'
          ? null
          : parseStoredRunState(window.localStorage.getItem(storageKeyForSession(sessionId)), sessionId);

      setSession(nextSession);
      setRunState(
        storedState
          ? clampRunState(storedState, sortedActivities)
          : createInitialRunState(sessionId, sortedActivities)
      );
      setIsLoading(false);
    }

    if (!authLoading && user) {
      void loadSession();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [authLoading, getSession, sessionId, user]);

  const activities = useMemo<RunActivity[]>(() => {
    if (!session) return [];

    const timings = calculateActivityTimings(
      session.activities.map((activity) => ({
        id: activity.id,
        duration: activity.duration,
      })),
      session.start_time || '17:00',
      session.duration || session.activities.reduce((sum, activity) => sum + activity.duration, 0)
    );
    const timingMap = new Map(timings.map((timing) => [timing.id, timing]));

    return session.activities.map((activity) => {
      const timing = timingMap.get(activity.id);
      return {
        ...activity,
        plannedStartTime: timing?.startTime || null,
        plannedEndTime: timing?.endTime || null,
      };
    });
  }, [session]);

  const activeActivity = runState ? activities[runState.activeIndex] || null : null;
  const nextActivity = runState ? activities[runState.activeIndex + 1] || null : null;
  const completedCount = runState?.completedActivityIds.length || 0;
  const totalPlannedSeconds = activities.reduce(
    (sum, activity) => sum + secondsForActivity(activity),
    0
  );
  const progressPercent =
    totalPlannedSeconds > 0 && runState
      ? Math.min(100, Math.round((runState.elapsedSeconds / totalPlannedSeconds) * 100))
      : 0;
  const activeProgressPercent =
    activeActivity && runState
      ? Math.min(
          100,
          Math.round(
            ((secondsForActivity(activeActivity) - runState.remainingSeconds) /
              secondsForActivity(activeActivity)) *
              100
          )
        )
      : 0;
  const runSummary = session && runState ? buildRunSummary(session, activities, runState) : '';

  useEffect(() => {
    if (!runState) return;
    window.localStorage.setItem(storageKeyForSession(runState.sessionId), JSON.stringify(runState));
  }, [runState]);

  useEffect(() => {
    if (!runState || runState.status !== 'running') {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const previousTick = lastTickRef.current || now;
      const deltaSeconds = Math.max(1, Math.floor((now - previousTick) / 1000));

      if (deltaSeconds <= 0) return;
      lastTickRef.current = now;
      setRunState((previous) =>
        previous ? advanceRunState(previous, activities, deltaSeconds) : previous
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activities, runState?.status]);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 2400);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const updateRunState = useCallback((updater: (previous: RunState) => RunState) => {
    setRunState((previous) => (previous ? updater(previous) : previous));
  }, []);

  const handlePlayPause = useCallback(() => {
    updateRunState((previous) => {
      if (previous.status === 'running') {
        return { ...previous, status: 'paused', updatedAt: Date.now() };
      }

      if (previous.status === 'complete') {
        return previous;
      }

      return { ...previous, status: 'running', updatedAt: Date.now() };
    });
  }, [updateRunState]);

  const handleReset = useCallback(() => {
    if (!session) return;
    if (!confirm('Reset live progress and notes for this session?')) return;
    const nextState = createInitialRunState(sessionId, session.activities);
    window.localStorage.removeItem(storageKeyForSession(sessionId));
    setRunState(nextState);
  }, [session, sessionId]);

  const jumpToActivity = useCallback(
    (index: number) => {
      updateRunState((previous) => {
        const safeIndex = Math.min(Math.max(index, 0), Math.max(activities.length - 1, 0));
        return {
          ...previous,
          activeIndex: safeIndex,
          remainingSeconds: secondsForActivity(activities[safeIndex]),
          status: previous.status === 'complete' ? 'paused' : previous.status,
          updatedAt: Date.now(),
        };
      });
    },
    [activities, updateRunState]
  );

  const markActiveComplete = useCallback(() => {
    updateRunState((previous) => {
      const active = activities[previous.activeIndex];
      if (!active) return previous;

      const completedActivityIds = Array.from(
        new Set([...previous.completedActivityIds, active.id])
      );

      if (previous.activeIndex >= activities.length - 1) {
        return {
          ...previous,
          remainingSeconds: 0,
          completedActivityIds,
          status: 'complete',
          updatedAt: Date.now(),
        };
      }

      const nextIndex = previous.activeIndex + 1;
      return {
        ...previous,
        activeIndex: nextIndex,
        remainingSeconds: secondsForActivity(activities[nextIndex]),
        completedActivityIds,
        updatedAt: Date.now(),
      };
    });
  }, [activities, updateRunState]);

  const addTime = useCallback(
    (seconds: number) => {
      updateRunState((previous) => ({
        ...previous,
        remainingSeconds: Math.max(0, previous.remainingSeconds + seconds),
        updatedAt: Date.now(),
      }));
    },
    [updateRunState]
  );

  const updateActivityNote = useCallback(
    (activityId: string, note: string) => {
      updateRunState((previous) => ({
        ...previous,
        activityNotes: {
          ...previous.activityNotes,
          [activityId]: note,
        },
        updatedAt: Date.now(),
      }));
    },
    [updateRunState]
  );

  const appendQuickNote = useCallback(
    (activityId: string, prompt: string) => {
      updateRunState((previous) => ({
        ...previous,
        activityNotes: {
          ...previous.activityNotes,
          [activityId]: appendNote(previous.activityNotes[activityId], prompt),
        },
        updatedAt: Date.now(),
      }));
    },
    [updateRunState]
  );

  const updateSessionNotes = useCallback(
    (note: string) => {
      updateRunState((previous) => ({
        ...previous,
        sessionNotes: note,
        updatedAt: Date.now(),
      }));
    },
    [updateRunState]
  );

  const handleCopySummary = useCallback(async () => {
    if (!runSummary) return;

    try {
      await navigator.clipboard.writeText(runSummary);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }, [runSummary]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-teal border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">Sign in required</h1>
          <p className="mt-2 text-sm text-slate-500">Please sign in to run this session.</p>
          <Button asChild className="mt-5">
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!session || !runState) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">Session not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This plan may have been deleted or you may not have access to it.
          </p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/sessions">Back to sessions</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">No activities to run yet</h1>
          <p className="mt-2 text-sm text-slate-500">
            Add at least one activity to this practice plan before opening live mode.
          </p>
          <Button asChild className="mt-5">
            <Link href={`/dashboard/sessions/${session.id}`}>Edit session plan</Link>
          </Button>
        </div>
      </div>
    );
  }

  const statusLabel =
    runState.status === 'complete'
      ? 'Complete'
      : runState.status === 'running'
        ? 'Running'
        : runState.status === 'paused'
          ? 'Paused'
          : 'Ready';
  const upcomingActivities = activities.slice(runState.activeIndex + 1, runState.activeIndex + 3);
  const activeCategoryLabel = activeActivity?.category?.name || 'Activity';
  const coachCueLines = activeActivity?.notes
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <>
      <div className="min-h-full bg-[#f7f9fc] p-4 pb-40 md:hidden">
        <header className="mb-5 flex items-center gap-3">
          <Link
            href={`/dashboard/sessions/${session.id}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-navy shadow-sm"
            aria-label="Back to plan"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-[27px] font-extrabold leading-tight text-navy">
              Run Live
            </h1>
            <p className="truncate text-[15px] font-medium text-slate-500">{session.name}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
            aria-label="Reset run"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </header>

        <MobileListCard className="mb-4 space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-teal-light">
              <ListChecks className="h-10 w-10" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-teal">Current Activity</div>
              <h2 className="mt-1 text-[28px] font-extrabold leading-tight text-navy">
                {activeActivity?.name}
              </h2>
              <span className="mt-3 inline-flex rounded-2xl border border-teal px-3 py-1 text-sm font-extrabold text-teal">
                {activeCategoryLabel}
              </span>
            </div>
          </div>

          <div className="rounded-[24px] bg-slate-50 px-4 py-5 text-center">
            <div className="font-mono text-[64px] font-extrabold leading-none tracking-normal text-navy">
              {formatClock(runState.remainingSeconds)}
            </div>
            <div className="mt-2 text-sm font-extrabold uppercase tracking-normal text-slate-500">
              Remaining
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-teal transition-all duration-500"
                style={{ width: `${activeProgressPercent}%` }}
              />
            </div>
          </div>

          {activeActivity?.notes && (
            <div className="flex gap-3 rounded-2xl border border-accent/20 bg-teal-glow px-4 py-4 text-[17px] font-medium leading-7 text-navy">
              <MessageSquareText className="mt-1 h-6 w-6 shrink-0 text-teal" />
              <p className="line-clamp-3">{activeActivity.notes}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={runState.status === 'complete'}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-navy bg-white text-base font-extrabold text-navy disabled:opacity-50"
            >
              {runState.status === 'running' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {runState.status === 'running' ? 'Pause' : runState.status === 'paused' ? 'Resume' : 'Start'}
            </button>
            <button
              type="button"
              onClick={markActiveComplete}
              disabled={runState.status === 'complete'}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-teal text-base font-extrabold text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-5 w-5" />
              Complete
            </button>
          </div>
        </MobileListCard>

        <MobileListCard className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-navy">Up Next</h2>
            <span className="text-sm font-extrabold text-teal">
              {upcomingActivities.length} Activities
            </span>
          </div>
          {upcomingActivities.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {upcomingActivities.map((activity, offset) => (
                <div key={activity.id} className="flex items-center gap-4 py-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-glow font-mono text-xl font-extrabold text-teal">
                    {runState.activeIndex + offset + 2}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-base font-extrabold text-navy">
                      {activity.name}
                    </div>
                    {activity.category?.name && (
                      <div className="mt-1 inline-flex rounded-full border border-teal px-2 py-0.5 text-xs font-bold text-teal">
                        {activity.category.name}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold text-slate-500">{activity.duration} min</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">No remaining activities.</p>
          )}
        </MobileListCard>

        <MobileListCard className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-navy">Coaching Notes</h2>
            <Edit3 className="h-5 w-5 text-teal" />
          </div>
          {coachCueLines && coachCueLines.length > 0 ? (
            <ul className="space-y-3">
              {coachCueLines.map((line) => (
                <li key={line} className="flex gap-3 text-[16px] font-medium leading-6 text-navy">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal" />
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              No saved coaching notes for this activity.
            </p>
          )}
        </MobileListCard>

        <MobileListCard className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal-glow text-teal">
            <BarProgressIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-extrabold text-navy">
              {completedCount} of {activities.length} activities complete
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-teal" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </MobileListCard>
      </div>

      <MobileStickyActionBar>
        <button
          type="button"
          onClick={() => jumpToActivity(runState.activeIndex - 1)}
          disabled={runState.activeIndex === 0}
          className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-navy bg-white px-3 text-base font-extrabold text-navy disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
          Previous
        </button>
        <button
          type="button"
          onClick={markActiveComplete}
          disabled={runState.status === 'complete'}
          className="inline-flex min-h-14 flex-[1.2] items-center justify-center gap-2 rounded-2xl bg-teal px-3 text-sm font-extrabold text-white disabled:opacity-40 min-[390px]:text-base"
        >
          Next Activity
          <ChevronRight className="h-5 w-5" />
        </button>
        <Link
          href={`/dashboard/sessions/${session.id}`}
          className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-base font-extrabold text-navy"
        >
          <Edit3 className="h-5 w-5" />
          Edit
        </Link>
      </MobileStickyActionBar>

      <div className="hidden min-h-full bg-slate-50 p-3 md:block md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-[24px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link
                href={`/dashboard/sessions/${session.id}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-teal-light hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to plan
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="min-w-0 text-2xl font-bold text-white md:text-3xl">
                  {session.name}
                </h1>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/80">
                  {statusLabel}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/65">
                <span>{session.date || 'No date set'}</span>
                <span>
                  {formatTime12Hour(session.start_time || '17:00')}
                  {session.duration ? ` · ${session.duration} min plan` : ''}
                </span>
                <span>{session.location || 'No location set'}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <div className="font-mono text-2xl font-bold text-white">
                  {completedCount}/{activities.length}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                  Blocks
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                <div className="font-mono text-2xl font-bold text-white">
                  {progressPercent}%
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">
                  Plan
                </div>
              </div>
              <div className="rounded-2xl bg-teal p-3">
                <div className="font-mono text-2xl font-bold text-white">
                  {formatElapsed(runState.elapsedSeconds)}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">
                  Elapsed
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
          <section className="space-y-5">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-white p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      <Clock3 className="h-4 w-4" />
                      Current block
                    </div>
                    <h2 className="text-3xl font-bold text-slate-950 md:text-4xl">
                      {activeActivity?.name}
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      {activeActivity?.plannedStartTime && activeActivity.plannedEndTime && (
                        <span>
                          Planned {formatTime12Hour(activeActivity.plannedStartTime)}-
                          {formatTime12Hour(activeActivity.plannedEndTime)}
                        </span>
                      )}
                      <span>{activeActivity?.duration} min scheduled</span>
                      {activeActivity?.category?.name && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {activeActivity.category.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-[24px] bg-slate-950 px-6 py-5 text-center text-white md:min-w-[260px]">
                    <div className="font-mono text-[64px] font-bold leading-none tracking-[-0.04em]">
                      {formatClock(runState.remainingSeconds)}
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-teal transition-all duration-500"
                        style={{ width: `${activeProgressPercent}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                      {activeProgressPercent}% through block
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handlePlayPause}
                    disabled={runState.status === 'complete'}
                    className="h-12 rounded-xl bg-teal px-6 text-base font-bold hover:bg-teal-dark"
                  >
                    {runState.status === 'running' ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                    {runState.status === 'running' ? 'Pause' : 'Start'}
                  </Button>
                  <Button variant="outline" onClick={() => addTime(60)} className="h-12 rounded-xl">
                    +1 min
                  </Button>
                  <Button variant="outline" onClick={() => addTime(-60)} className="h-12 rounded-xl">
                    -1 min
                  </Button>
                  <Button variant="outline" onClick={markActiveComplete} className="h-12 rounded-xl">
                    <SkipForward className="h-4 w-4" />
                    Finish block
                  </Button>
                  <Button variant="ghost" onClick={handleReset} className="h-12 rounded-xl">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>

              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="p-5 md:p-6">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    <StickyNote className="h-4 w-4" />
                    Block notes
                  </div>
                  <textarea
                    value={activeActivity ? runState.activityNotes[activeActivity.id] || '' : ''}
                    onChange={(event) => {
                      if (activeActivity) updateActivityNote(activeActivity.id, event.target.value);
                    }}
                    rows={7}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-teal"
                    placeholder="What worked, what dragged, who needs follow-up..."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeActivity &&
                      QUICK_NOTE_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => appendQuickNote(activeActivity.id, prompt)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-teal hover:text-teal"
                        >
                          {prompt}
                        </button>
                      ))}
                  </div>
                </div>

                <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0 md:p-6">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Up next
                  </div>
                  {nextActivity ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="font-semibold text-slate-950">{nextActivity.name}</div>
                      <div className="mt-2 text-sm text-slate-500">
                        {nextActivity.duration} min
                        {nextActivity.plannedStartTime
                          ? ` · ${formatTime12Hour(nextActivity.plannedStartTime)}`
                          : ''}
                      </div>
                      {nextActivity.notes && (
                        <p className="mt-3 line-clamp-4 text-sm text-slate-600">
                          {nextActivity.notes}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                      Last planned block.
                    </div>
                  )}

                  {activeActivity?.linked_play_thumbnail_data_url && (
                    <div className="mt-5">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        Linked play
                      </div>
                      <Link
                        href={`/dashboard/plays/${activeActivity.linked_play_id}`}
                        className="block overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-teal"
                      >
                        <img
                          src={activeActivity.linked_play_thumbnail_data_url}
                          alt={activeActivity.linked_play_name_snapshot || 'Linked play'}
                          className="h-40 w-full object-cover"
                        />
                        <div className="p-3 text-sm font-semibold text-slate-800">
                          {activeActivity.linked_play_name_snapshot || 'View linked play'}
                        </div>
                      </Link>
                    </div>
                  )}
                </aside>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-950">Run of show</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => jumpToActivity(runState.activeIndex - 1)}
                    disabled={runState.activeIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => jumpToActivity(runState.activeIndex + 1)}
                    disabled={runState.activeIndex >= activities.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {activities.map((activity, index) => {
                  const isActive = index === runState.activeIndex && runState.status !== 'complete';
                  const isDone = runState.completedActivityIds.includes(activity.id);
                  return (
                    <button
                      key={activity.id}
                      onClick={() => jumpToActivity(index)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-teal bg-accent/5'
                          : isDone
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? 'bg-teal text-white'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-slate-900">
                          {activity.name}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-500">
                          {activity.duration} min
                          {activity.plannedStartTime && activity.plannedEndTime
                            ? ` · ${formatTime12Hour(activity.plannedStartTime)}-${formatTime12Hour(
                                activity.plannedEndTime
                              )}`
                            : ''}
                        </span>
                      </span>
                      {runState.activityNotes[activity.id]?.trim() && (
                        <StickyNote className="h-4 w-4 shrink-0 text-teal" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Coach cues
              </div>
              {activeActivity?.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {activeActivity.notes}
                </p>
              ) : (
                <p className="text-sm text-slate-500">No saved coaching notes for this block.</p>
              )}

              {activeActivity?.groups && activeActivity.groups.length > 0 && (
                <div className="mt-5 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Groups
                  </div>
                  {(activeActivity.groups as ActivityGroup[]).map((group, index) => (
                    <div key={`${group.name}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                      <div className="font-semibold text-slate-900">
                        {group.name || `Group ${index + 1}`}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {group.player_ids.length} assigned players
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Session notes
                </div>
                <TimerReset className="h-4 w-4 text-slate-400" />
              </div>
              <textarea
                value={runState.sessionNotes}
                onChange={(event) => updateSessionNotes(event.target.value)}
                rows={8}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-teal"
                placeholder="Whole-practice observations, follow-ups, lineup notes..."
              />
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-950">Post-session summary</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Copies elapsed time, block status, and notes.
                  </p>
                </div>
                <Button variant="outline" size="icon-sm" onClick={handleCopySummary}>
                  <ClipboardCopy className="h-4 w-4" />
                </Button>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {runSummary}
              </pre>
              {copyStatus !== 'idle' && (
                <p
                  className={`mt-2 text-sm font-semibold ${
                    copyStatus === 'copied' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {copyStatus === 'copied'
                    ? 'Summary copied.'
                    : 'Clipboard unavailable in this browser.'}
                </p>
              )}
            </section>
          </aside>
        </main>
      </div>
      </div>
    </>
  );
}

function BarProgressIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6" y="17" width="5" height="9" rx="2" fill="currentColor" opacity="0.55" />
      <rect x="14" y="11" width="5" height="15" rx="2" fill="currentColor" opacity="0.75" />
      <rect x="22" y="5" width="5" height="21" rx="2" fill="currentColor" />
    </svg>
  );
}
