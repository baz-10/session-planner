'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Info,
  ListChecks,
  MapPin,
  PlayCircle,
  Save,
  Sparkles,
  StickyNote,
  Quote,
  Shield,
  Timer,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSessions } from '@/hooks/use-sessions';
import { useDrills } from '@/hooks/use-drills';
import { usePlays } from '@/hooks/use-plays';
import { usePlayers } from '@/hooks/use-players';
import { usePlayEditorTheme } from '@/hooks/use-play-editor-theme';
import { useBranding } from '@/hooks/use-branding';
import { ActivityTable } from './activity-table';
import { DrillSelectorModal } from './drill-selector-modal';
import { PlaySelectorModal } from './play-selector-modal';
import { SessionAutopilotPanel } from './session-autopilot-panel';
import { Button } from '@/components/ui/button';
import { useConfirmDialog, useTextPromptDialog } from '@/components/ui';
import {
  MobileEmptyState,
  MobileListCard,
  MobileStickyActionBar,
} from '@/components/mobile';
import { CategoryManager } from '@/components/drills/category-manager';
import { printSessionPlan } from '@/lib/utils/pdf-export';
import { buildDrillTags, getAdditionalCategoryIdsFromTags } from '@/lib/utils/drill-tags';
import {
  calculateActivityTimings,
  formatDuration,
  formatTime12Hour,
} from '@/lib/utils/time';
import type {
  Session,
  SessionActivity,
  DrillCategory,
  Drill,
  Play,
  Player,
} from '@/types/database';
import type { SessionAutopilotVariant } from '@/lib/ai/session-autopilot-types';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface SessionWithActivities extends Session {
  activities: ActivityWithCategory[];
}

interface DrillWithCategory extends Drill {
  category?: DrillCategory | null;
}

type SessionBuilderStatusType = 'success' | 'error' | 'warning' | 'info';

interface SessionBuilderStatus {
  type: SessionBuilderStatusType;
  text: string;
}

interface DeferredSessionBuilderStatus {
  sessionId: string;
  message: SessionBuilderStatus;
}

const DEFERRED_SESSION_BUILDER_STATUS_KEY = 'session-planner:session-builder-status';
const SESSION_BUILDER_STATUS_TYPES = new Set<SessionBuilderStatusType>([
  'success',
  'error',
  'warning',
  'info',
]);

const STATUS_BANNER_CLASSES: Record<SessionBuilderStatusType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  error: 'border-red-200 bg-red-50 text-red-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-sky-200 bg-sky-50 text-sky-950',
};

const STATUS_ICON_CLASSES: Record<SessionBuilderStatusType, string> = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-sky-600',
};

const STATUS_BANNER_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const CATEGORY_FALLBACK_COLORS: Record<string, string> = {
  warmup: '#94a3b8',
  passing: '#f59e0b',
  defense: '#ef4444',
  play: '#14b8a6',
  conditioning: '#8b5cf6',
  shooting: '#eab308',
  live: '#1e3a5f',
  wrap: '#64748b',
};

function addMinutesToTime(startTime: string, minutesToAdd: number): string {
  const [hours, minutes] = (startTime || '17:00').split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const nextHours = Math.floor(totalMinutes / 60) % 24;
  const nextMinutes = totalMinutes % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
}

function resolveCategoryColor(activity: ActivityWithCategory): string {
  if (activity.category?.color) {
    return activity.category.color;
  }

  const lookupKey = activity.category?.name?.toLowerCase().trim() || '';
  return CATEGORY_FALLBACK_COLORS[lookupKey] || '#94a3b8';
}

const SESSION_DURATION_OPTIONS = [60, 75, 90, 105, 120, 150, 180] as const;

function formatDurationOptionLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) {
    return `${minutes} min (${hours} hour${hours === 1 ? '' : 's'})`;
  }

  return `${minutes} min (${hours}h ${remainder}m)`;
}

function toInputDate(value?: string | null): string {
  return value || '';
}

function clampActivityDuration(value: number): number {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 10));
}

function isSessionBuilderStatus(value: unknown): value is SessionBuilderStatus {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SessionBuilderStatus>;
  return (
    typeof candidate.text === 'string' &&
    SESSION_BUILDER_STATUS_TYPES.has(candidate.type as SessionBuilderStatusType)
  );
}

function storeDeferredSessionBuilderStatus(sessionId: string, message: SessionBuilderStatus) {
  try {
    window.sessionStorage.setItem(
      DEFERRED_SESSION_BUILDER_STATUS_KEY,
      JSON.stringify({ sessionId, message } satisfies DeferredSessionBuilderStatus)
    );
  } catch {
    // Status persistence is best-effort; the draft still exists if storage is unavailable.
  }
}

function takeDeferredSessionBuilderStatus(sessionId?: string): SessionBuilderStatus | null {
  if (!sessionId) {
    return null;
  }

  try {
    const rawStatus = window.sessionStorage.getItem(DEFERRED_SESSION_BUILDER_STATUS_KEY);
    if (!rawStatus) {
      return null;
    }

    const parsedStatus = JSON.parse(rawStatus) as Partial<DeferredSessionBuilderStatus>;
    if (parsedStatus.sessionId !== sessionId || !isSessionBuilderStatus(parsedStatus.message)) {
      return null;
    }

    window.sessionStorage.removeItem(DEFERRED_SESSION_BUILDER_STATUS_KEY);
    return parsedStatus.message;
  } catch {
    try {
      window.sessionStorage.removeItem(DEFERRED_SESSION_BUILDER_STATUS_KEY);
    } catch {
      // Ignore unavailable session storage.
    }
    return null;
  }
}

const normalizeActivitySortOrder = (
  activities: ActivityWithCategory[]
): ActivityWithCategory[] =>
  activities.map((activity, index) => ({
    ...activity,
    sort_order: index,
  }));

const normalizeAdditionalCategoryIds = (
  categoryIds: Array<string | null | undefined>,
  primaryCategoryId?: string | null
): string[] =>
  Array.from(new Set(categoryIds.filter(Boolean) as string[])).filter(
    (categoryId) => categoryId !== primaryCategoryId
  );

interface SessionBuilderProps {
  sessionId?: string;
  isNew?: boolean;
}

export function SessionBuilder({ sessionId, isNew = false }: SessionBuilderProps) {
  const router = useRouter();
  const { currentTeam, teamMemberships, setCurrentTeam } = useAuth();
  const { displayName } = useBranding();
  const {
    getSession,
    createSession,
    updateSession,
    addActivity,
    updateActivity,
    deleteActivity,
    reorderActivities,
    duplicateSession,
  } = useSessions();
  const { getCategories, getDrills, createDrill } = useDrills();
  const { getPlays, getPlay } = usePlays();
  const { getTeamPlayers } = usePlayers();
  const { theme: playTheme } = usePlayEditorTheme();

  // Session state
  const [session, setSession] = useState<Partial<SessionWithActivities>>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '17:00',
    duration: 90,
    location: '',
    defensive_emphasis: '',
    offensive_emphasis: '',
    quote: '',
    announcements: '',
    activities: [],
  });

  const [categories, setCategories] = useState<DrillCategory[]>([]);
  const [drillCategoryIdsByDrillId, setDrillCategoryIdsByDrillId] = useState<
    Record<string, string[]>
  >({});
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingActivitiesToLibrary, setIsSavingActivitiesToLibrary] = useState(false);
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [drillModalMode, setDrillModalMode] = useState<'single' | 'multiple'>('single');
  const [targetPlayActivityId, setTargetPlayActivityId] = useState<string | null>(null);
  const [playsById, setPlaysById] = useState<Record<string, Play>>({});
  const [playerLabelsById, setPlayerLabelsById] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAutopilot, setShowAutopilot] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [statusMessage, setStatusMessage] = useState<SessionBuilderStatus | null>(null);
  const [drillModalInitialTab, setDrillModalInitialTab] = useState<'library' | 'custom'>('library');
  const { confirmAction, confirmDialog } = useConfirmDialog();
  const { promptForText, textPromptDialog } = useTextPromptDialog();
  const activeTeamId = session.team_id || currentTeam?.id;
  const currentMembership = teamMemberships.find((membership) => membership.team.id === activeTeamId);
  const canManageSessions = currentMembership?.role === 'coach' || currentMembership?.role === 'admin';
  const canManagePlayLinks = canManageSessions;

  const showStatus = useCallback((message: SessionBuilderStatus) => {
    setStatusMessage(message);
  }, []);

  const confirmDiscardUnsavedChanges = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) {
      return true;
    }

    return confirmAction({
      title: 'Leave without saving?',
      description: 'Your changes are still local. Save the plan before leaving if you want to keep them.',
      confirmLabel: 'Leave page',
      confirmVariant: 'destructive',
    });
  }, [confirmAction, hasUnsavedChanges, isSaving]);

  const navigateWithUnsavedGuard = useCallback(
    async (href: string) => {
      const shouldNavigate = await confirmDiscardUnsavedChanges();
      if (!shouldNavigate) return;
      router.push(href);
    },
    [confirmDiscardUnsavedChanges, router]
  );

  useEffect(() => {
    if (!hasUnsavedChanges || isSaving) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isSaving]);

  useEffect(() => {
    if (!hasUnsavedChanges || isSaving) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') {
        return;
      }

      const nextUrl = new URL(anchor.href);
      if (
        nextUrl.origin !== window.location.origin ||
        (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search)
      ) {
        return;
      }

      event.preventDefault();
      void navigateWithUnsavedGuard(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [hasUnsavedChanges, isSaving, navigateWithUnsavedGuard]);

  useEffect(() => {
    const deferredStatus = takeDeferredSessionBuilderStatus(sessionId);
    if (deferredStatus) {
      setStatusMessage(deferredStatus);
    }
  }, [sessionId]);

  const loadSession = useCallback(async (targetSessionId = sessionId) => {
    if (!targetSessionId) return false;
    setIsLoading(true);
    const data = await getSession(targetSessionId);
    if (data) {
      setSession(data);
      setLoadError('');
      setIsLoading(false);
      return true;
    } else {
      setLoadError('Session not found, or you do not have access to this plan.');
    }
    setIsLoading(false);
    return false;
  }, [getSession, sessionId]);

  // Load session data if editing
  useEffect(() => {
    if (sessionId && !isNew) {
      void loadSession();
    }
  }, [sessionId, isNew, loadSession]);

  const loadCategories = useCallback(async () => {
    const data = await getCategories();
    setCategories(data);
  }, [getCategories]);

  const loadDrillCategoryContext = useCallback(async () => {
    const drills = await getDrills();
    const nextMap: Record<string, string[]> = {};

    drills.forEach((drill) => {
      const categoryIds = Array.from(
        new Set(
          [drill.category_id, ...getAdditionalCategoryIdsFromTags(drill.tags)].filter(Boolean)
        )
      ) as string[];

      nextMap[drill.id] = categoryIds;
    });

    setDrillCategoryIdsByDrillId(nextMap);
  }, [getDrills]);

  const loadPlayContext = useCallback(async () => {
    const plays = await getPlays();
    const nextMap: Record<string, Play> = {};
    plays.forEach((play) => {
      nextMap[play.id] = play;
    });
    setPlaysById(nextMap);
  }, [getPlays]);

  const loadPlayerContext = useCallback(async () => {
    if (!currentTeam?.id) {
      setPlayerLabelsById({});
      return;
    }

    const players = (await getTeamPlayers(currentTeam.id)) as Player[];
    const nextMap = (players || []).reduce<Record<string, string>>((accumulator, player) => {
      const firstName = player.first_name || '';
      const lastName = player.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      accumulator[player.id] = fullName || player.jersey_number || 'Player';
      return accumulator;
    }, {});

    setPlayerLabelsById(nextMap);
  }, [currentTeam?.id, getTeamPlayers]);

  // Keep drill/category data aligned with whichever team is currently selected.
  useEffect(() => {
    void Promise.all([
      loadCategories(),
      loadDrillCategoryContext(),
      loadPlayContext(),
      loadPlayerContext(),
    ]);
  }, [
    currentTeam?.id,
    loadCategories,
    loadDrillCategoryContext,
    loadPlayContext,
    loadPlayerContext,
  ]);

  // Ensure editing always uses the session's team context for drill/category actions.
  useEffect(() => {
    const sessionTeamId = session.team_id;
    if (!sessionTeamId || currentTeam?.id === sessionTeamId) {
      return;
    }

    const membership = teamMemberships.find((item) => item.team.id === sessionTeamId);
    if (membership) {
      setCurrentTeam(membership.team);
    }
  }, [session.team_id, currentTeam?.id, teamMemberships, setCurrentTeam]);

  useEffect(() => {
    if (categories.length === 0) return;

    setSession((prev) => {
      const currentActivities = prev.activities || [];
      if (currentActivities.length === 0) return prev;

      return {
        ...prev,
        activities: currentActivities.map((activity) => ({
          ...activity,
          category:
            categories.find((category) => category.id === activity.category_id) ||
            null,
        })),
      };
    });
  }, [categories]);

  // Handle metadata changes
  const handleMetadataChange = useCallback((updates: Partial<Session>) => {
    if (!canManageSessions) return;
    setStatusMessage(null);
    setSession((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, [canManageSessions]);

  // Handle activity changes
  const handleActivityUpdate = useCallback(
    async (activityId: string, updates: Partial<SessionActivity>) => {
      if (!canManageSessions) return;

      const resolvedCategoryId =
        updates.category_id !== undefined ? updates.category_id : null;
      const resolvedCategory =
        updates.category_id !== undefined
          ? categories.find((category) => category.id === resolvedCategoryId) || null
          : undefined;
      const normalizedAdditionalCategoryIds =
        updates.additional_category_ids !== undefined
          ? normalizeAdditionalCategoryIds(
              updates.additional_category_ids,
              updates.category_id !== undefined ? resolvedCategoryId : undefined
            )
          : undefined;
      const normalizedUpdates: Partial<SessionActivity> = {
        ...updates,
        ...(updates.duration !== undefined
          ? { duration: clampActivityDuration(Number(updates.duration)) }
          : {}),
        ...(normalizedAdditionalCategoryIds !== undefined
          ? { additional_category_ids: normalizedAdditionalCategoryIds }
          : {}),
      };
      const previousActivities = session.activities || [];

      // Update local state immediately for responsiveness
      setSession((prev) => ({
        ...prev,
        activities: prev.activities?.map((a) =>
          a.id === activityId
            ? {
                ...a,
                ...normalizedUpdates,
                ...(updates.category_id !== undefined ? { category: resolvedCategory } : {}),
              }
            : a
        ),
      }));

      // If session is saved, persist to database
      if (session.id) {
        const result = await updateActivity(activityId, normalizedUpdates, session.id);
        if (!result.success) {
          setSession((prev) => ({ ...prev, activities: previousActivities }));
          showStatus({
            type: 'error',
            text: `Failed to save activity changes: ${result.error || 'Please try again.'}`,
          });
        }
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [canManageSessions, session.activities, session.id, updateActivity, categories, showStatus]
  );

  const handleActivityDelete = useCallback(
    async (activityId: string) => {
      if (!canManageSessions) return;

      const activityName =
        session.activities?.find((activity) => activity.id === activityId)?.name || 'this activity';
      const confirmed = await confirmAction({
        title: 'Delete activity?',
        description: `${activityName} will be removed from this practice plan.`,
        confirmLabel: 'Delete activity',
        confirmVariant: 'destructive',
      });

      if (!confirmed) return;

      if (session.id) {
        const result = await deleteActivity(activityId, session.id);
        if (!result.success) {
          showStatus({
            type: 'error',
            text: `Failed to delete activity: ${result.error || 'Please try again.'}`,
          });
          return;
        }
      }

      // Update local state
      setSession((prev) => {
        const remainingActivities = (prev.activities || []).filter((a) => a.id !== activityId);
        return {
          ...prev,
          activities: normalizeActivitySortOrder(remainingActivities),
        };
      });

      if (!session.id) {
        setHasUnsavedChanges(true);
      }
    },
    [canManageSessions, confirmAction, session.activities, session.id, deleteActivity, showStatus]
  );

  const handleReorder = useCallback(
    async (activityIds: string[]) => {
      if (!canManageSessions) return;

      // Update local state
      const activities = session.activities || [];
      const previousActivities = activities;
      const reorderedActivities = normalizeActivitySortOrder(
        activityIds
          .map((id) => activities.find((a) => a.id === id))
          .filter(Boolean) as ActivityWithCategory[]
      );

      setSession((prev) => ({
        ...prev,
        activities: reorderedActivities,
      }));

      // If session is saved, persist to database
      if (session.id) {
        const result = await reorderActivities(session.id, activityIds);
        if (!result.success) {
          setSession((prev) => ({ ...prev, activities: previousActivities }));
          showStatus({
            type: 'error',
            text: `Failed to reorder activities: ${result.error || 'Please try again.'}`,
          });
        }
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [canManageSessions, session.id, session.activities, reorderActivities, showStatus]
  );

  // Add activity from drill library
  const handleAddDrill = useCallback(
    async (drill: DrillWithCategory) => {
      if (!canManageSessions) return;

      const additionalCategoryIds = normalizeAdditionalCategoryIds(
        getAdditionalCategoryIdsFromTags(drill.tags),
        drill.category_id
      );
      const duration = clampActivityDuration(drill.default_duration);

      const newActivity: Partial<SessionActivity> = {
        id: `temp-${Date.now()}`,
        drill_id: drill.id,
        name: drill.name,
        duration,
        category_id: drill.category_id,
        additional_category_ids: additionalCategoryIds,
        notes: drill.description || '',
        sort_order: session.activities?.length || 0,
        groups: [],
        linked_play_id: null,
        linked_play_name_snapshot: null,
        linked_play_version_snapshot: null,
        linked_play_snapshot: null,
        linked_play_thumbnail_data_url: null,
      };

      // If session is saved, add to database
      if (session.id) {
        const result = await addActivity({
          session_id: session.id,
          drill_id: drill.id,
          sort_order: session.activities?.length || 0,
          name: drill.name,
          duration,
          category_id: drill.category_id || undefined,
          additional_category_ids: additionalCategoryIds,
          notes: drill.description || undefined,
        });

        if (result.success && result.activity) {
          setSession((prev) => ({
            ...prev,
            activities: [
              ...(prev.activities || []),
              { ...result.activity, category: drill.category } as ActivityWithCategory,
            ],
          }));
        } else {
          showStatus({
            type: 'error',
            text: `Failed to add activity: ${result.error || 'Please try again.'}`,
          });
          return;
        }
      } else {
        // Add to local state with category attached
        setSession((prev) => ({
          ...prev,
          activities: [
            ...(prev.activities || []),
            {
              ...newActivity,
              category: drill.category || categories.find((c) => c.id === drill.category_id),
            } as ActivityWithCategory,
          ],
        }));
        setHasUnsavedChanges(true);
      }

      setIsDrillModalOpen(false);
    },
    [canManageSessions, session.id, session.activities, addActivity, categories, showStatus]
  );

  // Add multiple drills at once
  const handleAddMultipleDrills = useCallback(
    async (drills: DrillWithCategory[]) => {
      if (!canManageSessions) return;

      const currentActivitiesCount = session.activities?.length || 0;

      if (session.id) {
        // If session is saved, add each drill to database
        const newActivities: ActivityWithCategory[] = [];
        let failedCount = 0;

        for (let i = 0; i < drills.length; i++) {
          const drill = drills[i];
          const additionalCategoryIds = normalizeAdditionalCategoryIds(
            getAdditionalCategoryIdsFromTags(drill.tags),
            drill.category_id
          );
          const result = await addActivity({
            session_id: session.id,
            drill_id: drill.id,
            sort_order: currentActivitiesCount + i,
            name: drill.name,
            duration: clampActivityDuration(drill.default_duration),
            category_id: drill.category_id || undefined,
            additional_category_ids: additionalCategoryIds,
            notes: drill.description || undefined,
          });

          if (result.success && result.activity) {
            newActivities.push({
              ...result.activity,
              category: drill.category,
            } as ActivityWithCategory);
          } else {
            failedCount += 1;
          }
        }

        setSession((prev) => ({
          ...prev,
          activities: [...(prev.activities || []), ...newActivities],
        }));

        if (failedCount > 0) {
          showStatus({
            type: 'warning',
            text: `${failedCount} activit${failedCount === 1 ? 'y' : 'ies'} failed to add. Please try again.`,
          });
        }
      } else {
        // Add to local state
        const newActivities: ActivityWithCategory[] = drills.map((drill, index) => ({
          additional_category_ids: normalizeAdditionalCategoryIds(
            getAdditionalCategoryIdsFromTags(drill.tags),
            drill.category_id
          ),
          id: `temp-${Date.now()}-${index}`,
          session_id: '',
          drill_id: drill.id,
          name: drill.name,
          duration: clampActivityDuration(drill.default_duration),
          category_id: drill.category_id,
          notes: drill.description || null,
          sort_order: currentActivitiesCount + index,
          groups: [],
          linked_play_id: null,
          linked_play_name_snapshot: null,
          linked_play_version_snapshot: null,
          linked_play_snapshot: null,
          linked_play_thumbnail_data_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category: drill.category || categories.find((c) => c.id === drill.category_id),
        }));

        setSession((prev) => ({
          ...prev,
          activities: [...(prev.activities || []), ...newActivities],
        }));
        setHasUnsavedChanges(true);
      }

      setIsDrillModalOpen(false);
    },
    [canManageSessions, session.id, session.activities, addActivity, categories, showStatus]
  );

  // Add custom activity
  const handleAddCustomActivity = useCallback(
    async (name: string, duration: number, categoryId?: string) => {
      if (!canManageSessions) return;

      const category = categories.find((c) => c.id === categoryId);
      const safeDuration = clampActivityDuration(duration);

      if (session.id) {
        const result = await addActivity({
          session_id: session.id,
          sort_order: session.activities?.length || 0,
          name,
          duration: safeDuration,
          category_id: categoryId,
          additional_category_ids: [],
        });

        if (result.success && result.activity) {
          setSession((prev) => ({
            ...prev,
            activities: [
              ...(prev.activities || []),
              { ...result.activity, category } as ActivityWithCategory,
            ],
          }));
        } else {
          showStatus({
            type: 'error',
            text: `Failed to add custom activity: ${result.error || 'Please try again.'}`,
          });
          return;
        }
      } else {
        const newActivity: ActivityWithCategory = {
          id: `temp-${Date.now()}`,
          session_id: '',
          drill_id: null,
          name,
          duration: safeDuration,
          category_id: categoryId || null,
          additional_category_ids: [],
          notes: null,
          sort_order: session.activities?.length || 0,
          groups: [],
          linked_play_id: null,
          linked_play_name_snapshot: null,
          linked_play_version_snapshot: null,
          linked_play_snapshot: null,
          linked_play_thumbnail_data_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category,
        };

        setSession((prev) => ({
          ...prev,
          activities: [...(prev.activities || []), newActivity],
        }));
        setHasUnsavedChanges(true);
      }

      setIsDrillModalOpen(false);
    },
    [canManageSessions, session.id, session.activities, addActivity, categories, showStatus]
  );

  // Open drill modal in single mode
  const openSingleDrillModal = useCallback(() => {
    setDrillModalMode('single');
    setDrillModalInitialTab('library');
    setIsDrillModalOpen(true);
  }, []);

  const openCustomActivityModal = useCallback(() => {
    setDrillModalMode('single');
    setDrillModalInitialTab('custom');
    setIsDrillModalOpen(true);
  }, []);

  const openPlayModalForActivity = useCallback((activityId: string) => {
    if (!canManagePlayLinks) return;
    setTargetPlayActivityId(activityId);
    setIsPlayModalOpen(true);
  }, [canManagePlayLinks]);

  const closePlayModal = useCallback(() => {
    setTargetPlayActivityId(null);
    setIsPlayModalOpen(false);
  }, []);

  const handleAttachPlayToActivity = useCallback(
    async (play: Play) => {
      if (!targetPlayActivityId) return;
      if (!canManagePlayLinks) return;

      await handleActivityUpdate(targetPlayActivityId, {
        linked_play_id: play.id,
        linked_play_name_snapshot: play.name,
        linked_play_version_snapshot: play.version,
        linked_play_snapshot: play.diagram,
        linked_play_thumbnail_data_url: play.thumbnail_data_url,
      });

      setPlaysById((prev) => ({
        ...prev,
        [play.id]: play,
      }));

      closePlayModal();
    },
    [canManagePlayLinks, targetPlayActivityId, handleActivityUpdate, closePlayModal]
  );

  const handleClearLinkedPlay = useCallback(
    async (activityId: string) => {
      if (!canManagePlayLinks) return;
      await handleActivityUpdate(activityId, {
        linked_play_id: null,
        linked_play_name_snapshot: null,
        linked_play_version_snapshot: null,
        linked_play_snapshot: null,
        linked_play_thumbnail_data_url: null,
      });
    },
    [canManagePlayLinks, handleActivityUpdate]
  );

  const handleRefreshPlaySnapshot = useCallback(
    async (activityId: string) => {
      if (!canManagePlayLinks) return;
      const activity = (session.activities || []).find((item) => item.id === activityId);
      if (!activity?.linked_play_id) return;

      const latestPlay = (await getPlay(activity.linked_play_id)) || playsById[activity.linked_play_id];
      if (!latestPlay) {
        showStatus({
          type: 'error',
          text: 'The linked play no longer exists or cannot be accessed.',
        });
        return;
      }

      await handleActivityUpdate(activityId, {
        linked_play_id: latestPlay.id,
        linked_play_name_snapshot: latestPlay.name,
        linked_play_version_snapshot: latestPlay.version,
        linked_play_snapshot: latestPlay.diagram,
        linked_play_thumbnail_data_url: latestPlay.thumbnail_data_url,
      });

      setPlaysById((prev) => ({
        ...prev,
        [latestPlay.id]: latestPlay,
      }));
    },
    [canManagePlayLinks, session.activities, getPlay, playsById, handleActivityUpdate, showStatus]
  );

  const handleViewLinkedPlay = useCallback(
    async (activityId: string) => {
      const activity = (session.activities || []).find((item) => item.id === activityId);
      if (!activity?.linked_play_id) return;
      await navigateWithUnsavedGuard(`/dashboard/plays/${activity.linked_play_id}`);
    },
    [session.activities, navigateWithUnsavedGuard]
  );

  const isLinkedPlayStale = useCallback(
    (activity: ActivityWithCategory) => {
      if (!activity.linked_play_id || !activity.linked_play_version_snapshot) return false;
      const livePlay = playsById[activity.linked_play_id];
      if (!livePlay) return false;
      return livePlay.version > activity.linked_play_version_snapshot;
    },
    [playsById]
  );

  // Apply an autopilot-generated variant (replace existing activities)
  const handleApplyAutopilotVariant = useCallback(
    async (variant: SessionAutopilotVariant) => {
      if (!canManageSessions) return;

      const existingActivities = session.activities || [];
      if (session.id && existingActivities.length > 0) {
        const shouldCreateDraft = await confirmAction({
          title: 'Create Autopilot draft?',
          description: `Apply ${variant.label} as a new draft plan. Your current saved plan will stay unchanged.`,
          confirmLabel: 'Create draft',
        });

        if (!shouldCreateDraft) {
          return;
        }

        const targetTeamId = session.team_id || currentTeam?.id;
        if (!targetTeamId) {
          showStatus({
            type: 'error',
            text: 'No team selected. Please select a team before applying Autopilot.',
          });
          return;
        }

        setIsSaving(true);

        try {
          const draftResult = await createSession({
            team_id: targetTeamId,
            name: `${session.name || 'Session'} · ${variant.label}`,
            date: session.date || undefined,
            start_time: session.start_time || undefined,
            duration: session.duration || undefined,
            location: session.location || undefined,
            defensive_emphasis: session.defensive_emphasis || undefined,
            offensive_emphasis: session.offensive_emphasis || undefined,
            quote: session.quote || undefined,
            announcements: session.announcements || undefined,
          });

          if (!draftResult.success || !draftResult.session) {
            showStatus({
              type: 'error',
              text: `Failed to create Autopilot draft: ${draftResult.error || 'Please try again.'}`,
            });
            return;
          }

          let failedCount = 0;
          for (let index = 0; index < variant.activities.length; index += 1) {
            const generated = variant.activities[index];
            const additionalCategoryIds = normalizeAdditionalCategoryIds(
              generated.drillId ? drillCategoryIdsByDrillId[generated.drillId] || [] : [],
              generated.categoryId || null
            );
            const insertResult = await addActivity({
              session_id: draftResult.session.id,
              drill_id: generated.drillId,
              sort_order: index,
              name: generated.name,
              duration: clampActivityDuration(generated.duration),
              category_id: generated.categoryId,
              additional_category_ids: additionalCategoryIds,
              notes: generated.notes,
            });

            if (!insertResult.success) {
              failedCount += 1;
            }
          }

          if (failedCount > 0) {
            const draftWarning: SessionBuilderStatus = {
              type: 'warning',
              text: `Created the draft, but ${failedCount} Autopilot activities failed to save. Please review it before sharing.`,
            };
            storeDeferredSessionBuilderStatus(draftResult.session.id, draftWarning);
          }
          router.push(`/dashboard/sessions/${draftResult.session.id}`);
        } catch (error) {
          console.error('Failed to create Autopilot draft:', error);
          showStatus({
            type: 'error',
            text: 'Failed to create Autopilot draft. Check your connection and try again.',
          });
        } finally {
          setIsSaving(false);
        }
        return;
      }

      if (existingActivities.length > 0) {
        const shouldReplace = await confirmAction({
          title: 'Replace current activities?',
          description: `Apply ${variant.label} and replace ${existingActivities.length} existing activities in this plan.`,
          confirmLabel: 'Replace activities',
          confirmVariant: 'destructive',
        });

        if (!shouldReplace) {
          return;
        }
      }

      if (session.id) {
        // Empty persisted session: insert the generated plan directly.
        let didPersistAllChanges = true;

        const persistedActivities: ActivityWithCategory[] = [];
        for (let index = 0; index < variant.activities.length; index += 1) {
          const generated = variant.activities[index];
          const additionalCategoryIds = normalizeAdditionalCategoryIds(
            generated.drillId ? drillCategoryIdsByDrillId[generated.drillId] || [] : [],
            generated.categoryId || null
          );
          const insertResult = await addActivity({
            session_id: session.id,
            drill_id: generated.drillId,
            sort_order: index,
            name: generated.name,
            duration: clampActivityDuration(generated.duration),
            category_id: generated.categoryId,
            additional_category_ids: additionalCategoryIds,
            notes: generated.notes,
          });

          if (insertResult.success && insertResult.activity) {
            const insertedActivity = insertResult.activity;
            persistedActivities.push({
              ...insertedActivity,
              category:
                categories.find((category) => category.id === insertedActivity.category_id) ||
                null,
            });
          } else {
            didPersistAllChanges = false;
          }
        }

        setSession((prev) => ({
          ...prev,
          activities: normalizeActivitySortOrder(persistedActivities),
        }));

        if (!didPersistAllChanges) {
          showStatus({
            type: 'warning',
            text: 'Autopilot plan was partially applied. Some activity inserts failed. Please review the plan before sharing.',
          });
          setHasUnsavedChanges(true);
        }
        return;
      }

      // Unsaved session: replace in local state.
      const generatedActivities: ActivityWithCategory[] = variant.activities.map((generated, index) => ({
        additional_category_ids: normalizeAdditionalCategoryIds(
          generated.drillId ? drillCategoryIdsByDrillId[generated.drillId] || [] : [],
          generated.categoryId || null
        ),
        id: `temp-${Date.now()}-${index}`,
        session_id: '',
        drill_id: generated.drillId || null,
        name: generated.name,
        duration: clampActivityDuration(generated.duration),
        category_id: generated.categoryId || null,
        notes: generated.notes || null,
        sort_order: index,
        groups: [],
        linked_play_id: null,
        linked_play_name_snapshot: null,
        linked_play_version_snapshot: null,
        linked_play_snapshot: null,
        linked_play_thumbnail_data_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category:
          categories.find((category) => category.id === generated.categoryId) ||
          categories.find(
            (category) =>
              generated.categoryName &&
              category.name.toLowerCase() === generated.categoryName.toLowerCase()
          ) ||
          null,
      }));

      setSession((prev) => ({
        ...prev,
        activities: normalizeActivitySortOrder(generatedActivities),
      }));
      setHasUnsavedChanges(true);
    },
    [
      canManageSessions,
      session.activities,
      session.announcements,
      session.date,
      session.defensive_emphasis,
      session.duration,
      session.id,
      session.location,
      session.name,
      session.offensive_emphasis,
      session.quote,
      session.start_time,
      session.team_id,
      categories,
      addActivity,
      confirmAction,
      createSession,
      currentTeam?.id,
      drillCategoryIdsByDrillId,
      router,
      showStatus,
    ]
  );

  // Save session
  const persistUnsavedActivities = useCallback(
    async (targetSessionId: string) => {
      const normalizedActivities = normalizeActivitySortOrder(
        (session.activities || []) as ActivityWithCategory[]
      );

      let failedCount = 0;
      const nextActivities: ActivityWithCategory[] = [];

      for (const activity of normalizedActivities) {
        const needsInsert =
          !activity.id ||
          activity.id.startsWith('temp-') ||
          !activity.session_id ||
          activity.session_id !== targetSessionId;

        if (!needsInsert) {
          nextActivities.push({
            ...activity,
            session_id: targetSessionId,
          });
          continue;
        }

        const activityResult = await addActivity({
          session_id: targetSessionId,
          drill_id: activity.drill_id || undefined,
          sort_order: activity.sort_order,
          name: activity.name,
          duration: clampActivityDuration(activity.duration),
          category_id: activity.category_id || undefined,
          additional_category_ids: activity.additional_category_ids || [],
          notes: activity.notes || undefined,
          linked_play_id: activity.linked_play_id || undefined,
          linked_play_name_snapshot: activity.linked_play_name_snapshot || undefined,
          linked_play_version_snapshot: activity.linked_play_version_snapshot || undefined,
          linked_play_snapshot: activity.linked_play_snapshot || undefined,
          linked_play_thumbnail_data_url: activity.linked_play_thumbnail_data_url || null,
        });

        if (!activityResult.success || !activityResult.activity) {
          failedCount += 1;
          nextActivities.push({
            ...activity,
            session_id: targetSessionId,
          });
          continue;
        }

        nextActivities.push({
          ...activityResult.activity,
          category:
            activity.category ||
            categories.find((category) => category.id === activityResult.activity?.category_id) ||
            null,
        } as ActivityWithCategory);
      }

      return {
        failedCount,
        activities: normalizeActivitySortOrder(nextActivities),
      };
    },
    [session.activities, addActivity, categories]
  );

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    if (!session.name?.trim()) {
      showStatus({
        type: 'error',
        text: 'Please enter a session name before saving.',
      });
      return;
    }

    if (!canManageSessions) {
      showStatus({
        type: 'error',
        text: 'Only coaches or admins can save session plans for this team.',
      });
      return;
    }

    if (!currentTeam?.id) {
      showStatus({
        type: 'error',
        text: 'No team selected. Please select a team first.',
      });
      return;
    }

    setIsSaving(true);

    try {
      let didPersistAllChanges = true;
      let targetSessionId = session.id;

      if (session.id) {
        // Update existing session
        const updateResult = await updateSession(session.id, {
          name: session.name,
          date: session.date,
          start_time: session.start_time,
          duration: session.duration,
          location: session.location,
          defensive_emphasis: session.defensive_emphasis,
          offensive_emphasis: session.offensive_emphasis,
          quote: session.quote,
          announcements: session.announcements,
        });

        if (!updateResult.success) {
          showStatus({
            type: 'error',
            text: `Failed to save: ${updateResult.error || 'Unknown error'}`,
          });
          setIsSaving(false);
          return;
        }

        targetSessionId = session.id;
      } else {
        // Create new session
        const result = await createSession({
          team_id: currentTeam.id,
          name: session.name,
          date: session.date || undefined,
          start_time: session.start_time || undefined,
          duration: session.duration || undefined,
          location: session.location || undefined,
          defensive_emphasis: session.defensive_emphasis || undefined,
          offensive_emphasis: session.offensive_emphasis || undefined,
          quote: session.quote || undefined,
          announcements: session.announcements || undefined,
        });

        if (!result.success) {
          showStatus({
            type: 'error',
            text: `Failed to create session: ${result.error || 'Unknown error'}`,
          });
          setIsSaving(false);
          return;
        }

        if (result.session) {
          targetSessionId = result.session.id;
        }
      }

      if (targetSessionId) {
        const { failedCount, activities } = await persistUnsavedActivities(targetSessionId);

        if (failedCount > 0) {
          didPersistAllChanges = false;
        }

        setSession((prev) => ({
          ...prev,
          id: targetSessionId,
          activities,
        }));
      }

      if (!didPersistAllChanges) {
        showStatus({
          type: 'warning',
          text: 'Session details were saved, but one or more activities failed to save. Your local activities were kept so you can retry Save Plan.',
        });
        setHasUnsavedChanges(true);
        return;
      }

      if (!session.id && targetSessionId) {
        // Only navigate to edit route once all activities are persisted
        // so users never land on an empty activity list after save.
        router.replace(`/dashboard/sessions/${targetSessionId}`);
      }

      setHasUnsavedChanges(false);
      showStatus({
        type: 'success',
        text: 'Plan saved.',
      });
    } catch (error) {
      console.error('Save error:', error);
      showStatus({
        type: 'error',
        text: 'An unexpected error occurred while saving. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [session, currentTeam, canManageSessions, createSession, updateSession, persistUnsavedActivities, router, showStatus, isSaving]);

  // Save as new (duplicate)
  const handleSaveAsNew = useCallback(async () => {
    if (isSaving) return;

    if (!canManageSessions) {
      showStatus({
        type: 'error',
        text: 'Only coaches or admins can duplicate session plans for this team.',
      });
      return;
    }

    const newName = await promptForText({
      title: 'Duplicate practice plan',
      description: 'Name the copied plan before it is added to this team.',
      label: 'Plan name',
      defaultValue: `${session.name} (Copy)`,
      confirmLabel: 'Create copy',
      validate: (value) => (value ? null : 'Plan name is required.'),
    });

    if (!newName) return;

    if (session.id) {
      setIsSaving(true);
      try {
        const result = await duplicateSession(session.id, newName);
        if (result.success && result.session) {
          router.push(`/dashboard/sessions/${result.session.id}`);
        } else {
          showStatus({
            type: 'error',
            text: `Failed to duplicate plan: ${result.error || 'Please try again.'}`,
          });
        }
      } catch (error) {
        console.error('Duplicate session error:', error);
        showStatus({
          type: 'error',
          text: 'Failed to duplicate plan. Check your connection and try again.',
        });
      } finally {
        setIsSaving(false);
      }
    }
  }, [
    canManageSessions,
    session.id,
    session.name,
    duplicateSession,
    promptForText,
    router,
    showStatus,
    isSaving,
  ]);

  // Print session
  const handlePrint = useCallback(() => {
    if (isSaving) return;
    if (!session.name) return;
    const result = printSessionPlan(session as SessionWithActivities, currentTeam?.name || '', {
      categories,
      drillCategoryIdsByDrillId,
      appName: displayName,
    });

    if (!result.success) {
      showStatus({
        type: 'error',
        text: result.error,
      });
    }
  }, [session, currentTeam, categories, drillCategoryIdsByDrillId, displayName, showStatus, isSaving]);

  const handleSaveActivitiesToLibrary = useCallback(async () => {
    if (isSaving || isSavingActivitiesToLibrary) return;

    if (!canManageSessions) return;

    const activities = (session.activities || []) as ActivityWithCategory[];
    if (activities.length === 0) {
      showStatus({
        type: 'info',
        text: 'No activities to save yet.',
      });
      return;
    }

    setIsSavingActivitiesToLibrary(true);

    try {
      const existingDrills = await getDrills();
      const existingDrillIdByName = new Map(
        existingDrills
          .map((drill) => [drill.name.trim().toLowerCase(), drill.id] as const)
          .filter(([name]) => Boolean(name))
      );

      let createdCount = 0;
      let linkedExistingCount = 0;
      let skippedCount = 0;
      let failedCreateCount = 0;
      let failedLinkCount = 0;
      const drillIdByActivityId = new Map<string, string>();
      const existingDrillActivityIds = new Set<string>();

      for (const activity of activities) {
        const normalizedName = activity.name.trim().toLowerCase();
        const alreadyLinked = Boolean(activity.drill_id);

        if (!normalizedName || alreadyLinked) {
          skippedCount += 1;
          continue;
        }

        const existingDrillId = existingDrillIdByName.get(normalizedName);
        if (existingDrillId) {
          drillIdByActivityId.set(activity.id, existingDrillId);
          existingDrillActivityIds.add(activity.id);
          continue;
        }

        const createResult = await createDrill({
          name: activity.name.trim(),
          category_id: activity.category_id || undefined,
          default_duration: clampActivityDuration(activity.duration),
          description: activity.notes || undefined,
          notes: activity.notes || undefined,
          tags: buildDrillTags([], activity.additional_category_ids || []),
        });

        if (!createResult.success || !createResult.drill) {
          failedCreateCount += 1;
          continue;
        }

        createdCount += 1;
        existingDrillIdByName.set(normalizedName, createResult.drill.id);
        drillIdByActivityId.set(activity.id, createResult.drill.id);
      }

      const linkedDrillByActivityId = new Map<string, string>();

      if (drillIdByActivityId.size > 0) {
        if (session.id) {
          for (const [activityId, drillId] of drillIdByActivityId.entries()) {
            if (activityId.startsWith('temp-')) {
              linkedDrillByActivityId.set(activityId, drillId);
              if (existingDrillActivityIds.has(activityId)) {
                linkedExistingCount += 1;
              }
              setHasUnsavedChanges(true);
              continue;
            }

            const linkResult = await updateActivity(activityId, { drill_id: drillId }, session.id);
            if (linkResult.success) {
              linkedDrillByActivityId.set(activityId, drillId);
              if (existingDrillActivityIds.has(activityId)) {
                linkedExistingCount += 1;
              }
            } else {
              failedLinkCount += 1;
            }
          }
        } else {
          drillIdByActivityId.forEach((drillId, activityId) => {
            linkedDrillByActivityId.set(activityId, drillId);
            if (existingDrillActivityIds.has(activityId)) {
              linkedExistingCount += 1;
            }
          });
          setHasUnsavedChanges(true);
        }
      }

      if (linkedDrillByActivityId.size > 0) {
        setSession((prev) => ({
          ...prev,
          activities: (prev.activities || []).map((activity) =>
            linkedDrillByActivityId.has(activity.id)
              ? { ...activity, drill_id: linkedDrillByActivityId.get(activity.id) || activity.drill_id }
              : activity
          ),
        }));
      }

      const summaryParts = [
        `Saved ${createdCount} activit${createdCount === 1 ? 'y' : 'ies'} to Drill Library.`,
      ];

      if (skippedCount > 0) {
        summaryParts.push(
          `${skippedCount} skipped (already linked or missing a name).`
        );
      }
      if (linkedExistingCount > 0) {
        summaryParts.push(
          `Linked ${linkedExistingCount} existing drill${linkedExistingCount === 1 ? '' : 's'}.`
        );
      }
      if (failedCreateCount > 0) {
        summaryParts.push(`${failedCreateCount} failed to save.`);
      }
      if (failedLinkCount > 0) {
        summaryParts.push(
          `${failedLinkCount} created drill link${failedLinkCount === 1 ? '' : 's'} failed to update on the plan.`
        );
      }

      await loadDrillCategoryContext();

      showStatus({
        type: failedCreateCount > 0 || failedLinkCount > 0 ? 'warning' : 'success',
        text: summaryParts.join(' '),
      });
    } catch (error) {
      console.error('Failed to save activities to drill library:', error);
      showStatus({
        type: 'error',
        text: 'Failed to save activities to Drill Library. Please try again.',
      });
    } finally {
      setIsSavingActivitiesToLibrary(false);
    }
  }, [canManageSessions, session.activities, session.id, getDrills, createDrill, updateActivity, loadDrillCategoryContext, showStatus, isSaving, isSavingActivitiesToLibrary]);

  // Clear form
  const handleClear = useCallback(async () => {
    if (isSaving) return;

    if (!canManageSessions) return;

    if (session.id) {
      if (!hasUnsavedChanges) {
        showStatus({
          type: 'info',
          text: 'There are no unsaved changes to reset.',
        });
        return;
      }

      const shouldReset = await confirmAction({
        title: 'Reset unsaved changes?',
        description: 'The editor will reload the last saved version of this practice plan.',
        confirmLabel: 'Reset changes',
        confirmVariant: 'destructive',
      });

      if (!shouldReset) {
        return;
      }

      const didReload = await loadSession(session.id);
      if (!didReload) {
        showStatus({
          type: 'error',
          text: 'Could not reload the saved plan. Your local changes were kept.',
        });
        return;
      }

      setHasUnsavedChanges(false);
      showStatus({
        type: 'info',
        text: 'Unsaved changes were reset to the saved plan.',
      });
      return;
    }

    if (hasUnsavedChanges) {
      const shouldClear = await confirmAction({
        title: 'Clear unsaved changes?',
        description: 'The current form values and activities will be reset. Unsaved changes will be lost.',
        confirmLabel: 'Clear form',
        confirmVariant: 'destructive',
      });

      if (!shouldClear) {
        return;
      }
    }

    setSession({
      name: '',
      date: new Date().toISOString().split('T')[0],
      start_time: '17:00',
      duration: 90,
      location: '',
      defensive_emphasis: '',
      offensive_emphasis: '',
      quote: '',
      announcements: '',
      activities: [],
    });
    setHasUnsavedChanges(false);
  }, [canManageSessions, confirmAction, hasUnsavedChanges, loadSession, session.id, showStatus, isSaving]);

  const activities = useMemo(
    () => (session.activities || []) as ActivityWithCategory[],
    [session.activities]
  );
  const sessionStartTime = session.start_time || '17:00';
  const sessionDuration = session.duration || 90;
  const totalAllocatedMinutes = useMemo(
    () => activities.reduce((sum, activity) => sum + activity.duration, 0),
    [activities]
  );
  const sessionEndTime = useMemo(
    () => addMinutesToTime(sessionStartTime, sessionDuration),
    [sessionDuration, sessionStartTime]
  );
  const timelineRows = useMemo(() => {
    const timings = calculateActivityTimings(
      activities.map((activity) => ({
        id: activity.id,
        duration: activity.duration,
      })),
      sessionStartTime,
      sessionDuration
    );

    return activities.map((activity, index) => ({
      ...activity,
      color: resolveCategoryColor(activity),
      timing: timings[index],
    }));
  }, [activities, sessionDuration, sessionStartTime]);
  const offenseFocus = session.offensive_emphasis?.trim() || 'Set offense focus';
  const defenseFocus = session.defensive_emphasis?.trim() || 'Set defense focus';
  const StatusIcon = statusMessage ? STATUS_BANNER_ICONS[statusMessage.type] : Info;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-[#f8fafc] p-4 md:p-8">
        <MobileEmptyState
          title="Session unavailable"
          description={loadError}
          action={
            <Link href="/dashboard/sessions" className="btn-accent">
              Back to Sessions
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#f8fafc] p-4 pb-40 md:p-6 xl:p-8">
      <div className="space-y-4 md:hidden">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void navigateWithUnsavedGuard('/dashboard/sessions')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-navy shadow-sm"
            aria-label="Back to sessions"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[27px] font-extrabold leading-tight text-navy">
              Session Builder
            </h1>
            <div className="mt-1 truncate text-[17px] font-medium text-slate-500">
              {currentTeam?.name || 'Select a team'}
            </div>
          </div>
        </header>

        <MobileListCard className="space-y-4">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-teal-glow text-teal">
              <ListChecks className="h-8 w-8" />
            </div>
            <label className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-500">Session Name</span>
              <input
                type="text"
                value={session.name || ''}
                onChange={(event) => handleMetadataChange({ name: event.target.value })}
                disabled={isSaving || !canManageSessions}
                className="mt-1 w-full border-0 bg-transparent text-[20px] font-extrabold leading-6 text-navy outline-none placeholder:text-slate-400"
                placeholder="New practice plan"
              />
            </label>
          </div>

          <div className="divide-y divide-slate-200">
            <label className="grid min-h-[58px] grid-cols-[28px_1fr_1.2fr] items-center gap-3">
              <CalendarDays className="h-5 w-5 text-slate-500" />
              <span className="text-sm font-semibold text-slate-500">Date</span>
              <input
                type="date"
                value={toInputDate(session.date)}
                onChange={(event) => handleMetadataChange({ date: event.target.value || null })}
                disabled={isSaving || !canManageSessions}
                className="min-w-0 bg-transparent text-right text-base font-bold text-slate-700 outline-none"
              />
            </label>
            <label className="grid min-h-[58px] grid-cols-[28px_1fr_1.2fr] items-center gap-3">
              <Clock3 className="h-5 w-5 text-slate-500" />
              <span className="text-sm font-semibold text-slate-500">Start Time</span>
              <input
                type="time"
                value={sessionStartTime}
                onChange={(event) => handleMetadataChange({ start_time: event.target.value || null })}
                disabled={isSaving || !canManageSessions}
                className="min-w-0 bg-transparent text-right text-base font-bold text-slate-700 outline-none"
              />
            </label>
            <label className="grid min-h-[58px] grid-cols-[28px_1fr_1.2fr] items-center gap-3">
              <Timer className="h-5 w-5 text-slate-500" />
              <span className="text-sm font-semibold text-slate-500">Duration</span>
              <select
                value={String(sessionDuration)}
                onChange={(event) =>
                  handleMetadataChange({
                    duration: Number.parseInt(event.target.value, 10) || 90,
                  })
                }
                disabled={isSaving || !canManageSessions}
                className="min-w-0 bg-transparent text-right text-base font-bold text-slate-700 outline-none"
                aria-label="Session duration"
              >
                {SESSION_DURATION_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-h-[58px] grid-cols-[28px_1fr_1.2fr] items-center gap-3">
              <MapPin className="h-5 w-5 text-slate-500" />
              <span className="text-sm font-semibold text-slate-500">Location</span>
              <input
                type="text"
                value={session.location || ''}
                onChange={(event) => handleMetadataChange({ location: event.target.value || null })}
                disabled={isSaving || !canManageSessions}
                className="min-w-0 bg-transparent text-right text-base font-bold text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Add location"
              />
            </label>
          </div>
        </MobileListCard>

        <div className="grid grid-cols-2 gap-3">
          <MobileListCard className="min-h-[118px] p-4">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-glow text-teal">
              <TrendingUp className="h-6 w-6" />
            </div>
            <label>
              <span className="text-xs font-semibold text-slate-500">Offensive Emphasis</span>
              <input
                type="text"
                value={session.offensive_emphasis || ''}
                onChange={(event) =>
                  handleMetadataChange({ offensive_emphasis: event.target.value || null })
                }
                disabled={isSaving || !canManageSessions}
                className="mt-1 w-full bg-transparent text-sm font-extrabold text-navy outline-none placeholder:text-slate-400"
                placeholder="Set focus"
              />
            </label>
          </MobileListCard>

          <MobileListCard className="min-h-[118px] p-4">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <Shield className="h-6 w-6" />
            </div>
            <label>
              <span className="text-xs font-semibold text-slate-500">Defensive Emphasis</span>
              <input
                type="text"
                value={session.defensive_emphasis || ''}
                onChange={(event) =>
                  handleMetadataChange({ defensive_emphasis: event.target.value || null })
                }
                disabled={isSaving || !canManageSessions}
                className="mt-1 w-full bg-transparent text-sm font-extrabold text-navy outline-none placeholder:text-slate-400"
                placeholder="Set focus"
              />
            </label>
          </MobileListCard>
        </div>

        <MobileListCard className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="font-mono text-2xl font-extrabold text-navy">{activities.length}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">Activities</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-extrabold text-navy">
              {totalAllocatedMinutes}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">Allocated</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-extrabold text-teal">
              {Math.max(sessionDuration - totalAllocatedMinutes, 0)}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">Open min</div>
          </div>
        </MobileListCard>
      </div>

      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-[18px] border px-4 py-3 shadow-sm ${STATUS_BANNER_CLASSES[statusMessage.type]}`}
        >
          <StatusIcon
            className={`mt-0.5 h-5 w-5 shrink-0 ${STATUS_ICON_CLASSES[statusMessage.type]}`}
          />
          <p className="min-w-0 flex-1 text-sm font-semibold leading-6">{statusMessage.text}</p>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-current/70 transition hover:bg-black/5 hover:text-current focus:outline-none focus:ring-2 focus:ring-current/20"
            aria-label="Dismiss status message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="hidden overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1e3a5f] via-[#16314f] to-[#0f1f33] text-white shadow-[0_30px_80px_rgba(15,31,51,0.28)] md:block">
        <div className="relative overflow-hidden px-6 py-7 md:px-9">
          <div className="absolute right-[-90px] top-[-90px] h-80 w-80 rounded-full bg-teal opacity-20 blur-3xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="font-mono text-[12px] font-semibold tracking-[0.28em] text-teal-light">
                SESSION PLAN
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={session.name || ''}
                  onChange={(event) =>
                    handleMetadataChange({ name: event.target.value })
                  }
                  disabled={isSaving || !canManageSessions}
                  className="w-full min-w-0 bg-transparent text-[28px] font-bold tracking-[-0.04em] text-white outline-none placeholder:text-white/50 md:text-[30px] xl:max-w-[780px]"
                  placeholder="Enter session name"
                />
                {hasUnsavedChanges && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                    Unsaved
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_180px_200px_minmax(0,1fr)]">
                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80">
                  <CalendarDays className="h-4 w-4 text-teal-light" />
                  <input
                    type="date"
                    value={toInputDate(session.date)}
                    onChange={(event) =>
                      handleMetadataChange({ date: event.target.value || null })
                    }
                    disabled={isSaving || !canManageSessions}
                    className="w-full bg-transparent text-white outline-none [color-scheme:dark]"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80">
                  <Clock3 className="h-4 w-4 text-teal-light" />
                  <input
                    type="time"
                    value={sessionStartTime}
                    onChange={(event) =>
                      handleMetadataChange({ start_time: event.target.value || null })
                    }
                    disabled={isSaving || !canManageSessions}
                    className="w-full bg-transparent text-white outline-none [color-scheme:dark]"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80">
                  <Clock3 className="h-4 w-4 text-teal-light" />
                  <select
                    value={String(sessionDuration)}
                    onChange={(event) =>
                      handleMetadataChange({
                        duration: Number.parseInt(event.target.value, 10) || 90,
                      })
                    }
                    disabled={isSaving || !canManageSessions}
                    className="w-full bg-transparent text-white outline-none [color-scheme:dark]"
                    aria-label="Session duration"
                  >
                    {SESSION_DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes} className="text-slate-900">
                        {formatDurationOptionLabel(minutes)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80">
                  <MapPin className="h-4 w-4 text-teal-light" />
                  <input
                    type="text"
                    value={session.location || ''}
                    onChange={(event) =>
                      handleMetadataChange({ location: event.target.value || null })
                    }
                    disabled={isSaving || !canManageSessions}
                    className="w-full bg-transparent text-white outline-none placeholder:text-white/45"
                    placeholder="Main gym"
                  />
                </label>
              </div>

              <div className="mt-4 text-sm text-white/70">
                {session.date ? session.date : 'Choose a date'} ·{' '}
                {formatTime12Hour(sessionStartTime)}-{formatTime12Hour(sessionEndTime)} ·{' '}
                {session.location?.trim() || 'Add location'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {session.id && !hasUnsavedChanges && (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <Link href={`/dashboard/sessions/${session.id}/run`}>
                    <PlayCircle className="h-4 w-4" />
                    Run live
                  </Link>
                </Button>
              )}
              {session.id && hasUnsavedChanges && (
                <Button
                  variant="outline"
                  disabled
                  title="Save the plan before opening live mode."
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <PlayCircle className="h-4 w-4" />
                  Run live
                </Button>
              )}
              {session.id && canManageSessions && (
                <Button
                  variant="outline"
                  onClick={handleSaveAsNew}
                  disabled={isSaving}
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handlePrint}
                disabled={isSaving || !session.name}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                Print
              </Button>
              <Button
                variant="accent"
                onClick={handleSave}
                disabled={isSaving || !canManageSessions}
                isLoading={isSaving}
                className="bg-teal px-5 text-white hover:bg-teal-dark"
              >
                Save plan
              </Button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-teal px-4 py-3 text-white shadow-[0_14px_30px_rgba(20,184,166,0.2)]">
              <div className="font-mono text-[10px] font-semibold tracking-[0.18em] text-white/80">
                ALLOCATION
              </div>
              <div className="mt-2 text-[28px] font-bold leading-none">
                {totalAllocatedMinutes} / {sessionDuration}
              </div>
              <div className="mt-2 font-mono text-[11px] text-white/75">
                {Math.max(sessionDuration - totalAllocatedMinutes, 0)} min open
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <div className="font-mono text-[10px] font-semibold tracking-[0.18em] text-white/60">
                ACTIVITIES
              </div>
              <div className="mt-2 text-[28px] font-bold leading-none">
                {activities.length}
              </div>
              <div className="mt-2 font-mono text-[11px] text-white/70">
                {totalAllocatedMinutes > sessionDuration
                  ? 'over allocation'
                  : `${Math.max(sessionDuration - totalAllocatedMinutes, 0)} min open`}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <div className="font-mono text-[10px] font-semibold tracking-[0.18em] text-white/60">
                OFFENSE FOCUS
              </div>
              <div className="mt-2 text-sm font-semibold leading-6 text-white">
                {offenseFocus}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
              <div className="font-mono text-[10px] font-semibold tracking-[0.18em] text-white/60">
                DEFENSE FOCUS
              </div>
              <div className="mt-2 text-sm font-semibold leading-6 text-white">
                {defenseFocus}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="hidden rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm md:block md:px-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-base font-bold text-slate-950">Practice timeline</div>
          <div className="font-mono text-xs text-slate-500">
            {formatTime12Hour(sessionStartTime)} {'->'} {formatTime12Hour(sessionEndTime)}
          </div>
        </div>

        {timelineRows.length > 0 ? (
          <>
            <div className="flex h-14 gap-0.5 overflow-hidden rounded-xl bg-slate-100">
              {timelineRows.map((row) => (
                <div
                  key={row.id}
                  style={{ flex: row.duration, backgroundColor: row.color }}
                  className="relative flex min-w-[16px] items-end px-2 py-2"
                >
                  <span className="font-mono text-[10px] font-bold text-white drop-shadow">
                    {row.duration}m
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-0.5">
              {timelineRows.map((row) => (
                <div
                  key={`${row.id}-time`}
                  style={{ flex: row.duration }}
                  className="min-w-[16px] font-mono text-[10px] text-slate-500"
                >
                  {row.timing ? formatTime12Hour(row.timing.startTime) : '--'}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Add activities to build the timeline ribbon.
          </div>
        )}
      </section>

      <section className="hidden gap-4 md:grid xl:grid-cols-[1fr_1fr_1.2fr_1fr]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Offense emphasis
          </div>
          <input
            type="text"
            value={session.offensive_emphasis || ''}
            onChange={(event) =>
              handleMetadataChange({
                offensive_emphasis: event.target.value || null,
              })
            }
            disabled={isSaving || !canManageSessions}
            className="w-full border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Horns, ball-screen reads"
          />
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Defense emphasis
          </div>
          <input
            type="text"
            value={session.defensive_emphasis || ''}
            onChange={(event) =>
              handleMetadataChange({
                defensive_emphasis: event.target.value || null,
              })
            }
            disabled={isSaving || !canManageSessions}
            className="w-full border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Drop coverage against PnR"
          />
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <StickyNote className="h-3.5 w-3.5" />
            Session notes
          </div>
          <textarea
            value={session.announcements || ''}
            onChange={(event) =>
              handleMetadataChange({
                announcements: event.target.value || null,
              })
            }
            disabled={isSaving || !canManageSessions}
            rows={4}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none focus:border-teal"
            placeholder="General reminders, constraints, and coaching cues..."
          />
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <Quote className="h-3.5 w-3.5" />
            Quote of day
          </div>
          <textarea
            value={session.quote || ''}
            onChange={(event) =>
              handleMetadataChange({
                quote: event.target.value || null,
              })
            }
            disabled={isSaving || !canManageSessions}
            rows={4}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none focus:border-teal"
            placeholder="Lock into the details and the scoreboard takes care of itself."
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Activities</h2>
            <p className="text-sm text-slate-500">
              {activities.length > 0
                ? `${activities.length} blocks scheduled across ${formatDuration(
                    totalAllocatedMinutes
                  )}.`
                : 'Build the run of show for this session.'}
            </p>
          </div>

          {canManageSessions && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={openSingleDrillModal}
              disabled={isSaving}
              className="border-teal text-teal hover:bg-accent/5 hover:text-teal"
            >
              + From library
            </Button>
            <Button
              variant="outline"
              onClick={openCustomActivityModal}
              disabled={isSaving}
            >
              + Custom
            </Button>
            <Button
              variant="accent"
              onClick={() => setShowAutopilot((previous) => !previous)}
              disabled={isSaving}
              className="bg-gradient-teal text-white hover:opacity-95"
            >
              <Sparkles className="h-4 w-4" />
              Autopilot
            </Button>
          </div>
          )}
        </div>

        {!canManageSessions && (
          <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
            This is a view-only plan for your team role. Coaches and admins can edit the schedule.
          </div>
        )}

        {canManageSessions && showAutopilot && (
          <SessionAutopilotPanel
            teamId={currentTeam?.id}
            sessionContext={{
              sessionName: session.name,
              durationMinutes: session.duration || undefined,
              offensiveEmphasis: session.offensive_emphasis,
              defensiveEmphasis: session.defensive_emphasis,
              existingActivities: activities.map((activity) => ({
                name: activity.name,
                duration: Number(activity.duration) || 0,
              })),
            }}
            disabled={isSaving}
            onApplyVariant={handleApplyAutopilotVariant}
          />
        )}

        <ActivityTable
          activities={activities}
          sessionStartTime={sessionStartTime}
          totalDuration={sessionDuration}
          categories={categories}
          playTheme={playTheme}
          playerLabelsById={playerLabelsById}
          onActivityUpdate={handleActivityUpdate}
          onActivityDelete={handleActivityDelete}
          onReorder={handleReorder}
          onAddDrillClick={openSingleDrillModal}
          onAddCustomActivityClick={openCustomActivityModal}
          onManageCategoriesClick={() => setIsCategoryManagerOpen(true)}
          onSaveActivitiesToLibrary={
            canManageSessions ? handleSaveActivitiesToLibrary : undefined
          }
          isSavingActivitiesToLibrary={isSavingActivitiesToLibrary}
          canManagePlayLinks={Boolean(canManagePlayLinks)}
          onAttachPlayClick={canManagePlayLinks ? openPlayModalForActivity : undefined}
          onClearPlayClick={canManagePlayLinks ? handleClearLinkedPlay : undefined}
          onRefreshPlaySnapshotClick={
            canManagePlayLinks ? handleRefreshPlaySnapshot : undefined
          }
          onViewLinkedPlayClick={handleViewLinkedPlay}
          linkedPlayIsStale={isLinkedPlayStale}
          disabled={isSaving || !canManageSessions}
        />
      </section>

      {canManageSessions && (
      <div className="hidden flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isSaving || Boolean(session.id && !hasUnsavedChanges)}
        >
          {session.id ? 'Reset changes' : 'Clear form'}
        </Button>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-500">
            {hasUnsavedChanges
              ? 'Changes are local until you save the plan.'
              : 'All changes saved to this plan.'}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">
            {totalAllocatedMinutes} min allocated
          </span>
        </div>
      </div>
      )}

      {canManageSessions && (
      <MobileStickyActionBar>
        {session.id && !hasUnsavedChanges && (
          <Link
            href={`/dashboard/sessions/${session.id}/run`}
            aria-label="Run live"
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-navy bg-white px-3 text-sm font-extrabold text-navy"
          >
            <PlayCircle className="h-5 w-5" />
            Run
          </Link>
        )}
        <button
          type="button"
          onClick={openSingleDrillModal}
          disabled={isSaving}
          aria-label="+ Add Activity"
          className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-teal bg-white px-3 text-sm font-extrabold text-teal disabled:opacity-50"
        >
          + Add
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-navy px-3 text-sm font-extrabold text-white disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          {isSaving ? 'Saving' : 'Save'}
        </button>
      </MobileStickyActionBar>
      )}

      {/* Drill Selector Modal */}
      <DrillSelectorModal
        isOpen={isDrillModalOpen}
        onClose={() => setIsDrillModalOpen(false)}
        onSelect={handleAddDrill}
        onSelectMultiple={handleAddMultipleDrills}
        onAddCustom={handleAddCustomActivity}
        categories={categories}
        mode={drillModalMode}
        initialTab={drillModalInitialTab}
      />

      <PlaySelectorModal
        isOpen={isPlayModalOpen}
        onClose={closePlayModal}
        onSelect={handleAttachPlayToActivity}
      />

      {isCategoryManagerOpen && (
        <CategoryManager
          categories={categories}
          onClose={() => setIsCategoryManagerOpen(false)}
          onUpdate={loadCategories}
        />
      )}
      {confirmDialog}
      {textPromptDialog}
    </div>
  );
}
