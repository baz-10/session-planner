'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Copy,
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
import {
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
  const currentMembership = teamMemberships.find((membership) => membership.team.id === currentTeam?.id);
  const canManagePlayLinks = currentMembership?.role === 'coach' || currentMembership?.role === 'admin';

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

  // Load session data if editing
  useEffect(() => {
    if (sessionId && !isNew) {
      loadSession();
    }
  }, [sessionId, isNew]);

  const loadSession = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    const data = await getSession(sessionId);
    if (data) {
      setSession(data);
    }
    setIsLoading(false);
  };

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
    setSession((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

  // Handle activity changes
  const handleActivityUpdate = useCallback(
    async (activityId: string, updates: Partial<SessionActivity>) => {
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
        ...(normalizedAdditionalCategoryIds !== undefined
          ? { additional_category_ids: normalizedAdditionalCategoryIds }
          : {}),
      };

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
        await updateActivity(activityId, normalizedUpdates);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [session.id, updateActivity, categories]
  );

  const handleActivityDelete = useCallback(
    async (activityId: string) => {
      // Update local state
      setSession((prev) => {
        const remainingActivities = (prev.activities || []).filter((a) => a.id !== activityId);
        return {
          ...prev,
          activities: normalizeActivitySortOrder(remainingActivities),
        };
      });

      // If session is saved, delete from database
      if (session.id) {
        await deleteActivity(activityId);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [session.id, deleteActivity]
  );

  const handleReorder = useCallback(
    async (activityIds: string[]) => {
      // Update local state
      const activities = session.activities || [];
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
        await reorderActivities(session.id, activityIds);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [session.id, session.activities, reorderActivities]
  );

  // Add activity from drill library
  const handleAddDrill = useCallback(
    async (drill: DrillWithCategory) => {
      const additionalCategoryIds = normalizeAdditionalCategoryIds(
        getAdditionalCategoryIdsFromTags(drill.tags),
        drill.category_id
      );

      const newActivity: Partial<SessionActivity> = {
        id: `temp-${Date.now()}`,
        drill_id: drill.id,
        name: drill.name,
        duration: drill.default_duration,
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
          duration: drill.default_duration,
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
    [session.id, session.activities, addActivity, categories]
  );

  // Add multiple drills at once
  const handleAddMultipleDrills = useCallback(
    async (drills: DrillWithCategory[]) => {
      const currentActivitiesCount = session.activities?.length || 0;

      if (session.id) {
        // If session is saved, add each drill to database
        const newActivities: ActivityWithCategory[] = [];

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
            duration: drill.default_duration,
            category_id: drill.category_id || undefined,
            additional_category_ids: additionalCategoryIds,
            notes: drill.description || undefined,
          });

          if (result.success && result.activity) {
            newActivities.push({
              ...result.activity,
              category: drill.category,
            } as ActivityWithCategory);
          }
        }

        setSession((prev) => ({
          ...prev,
          activities: [...(prev.activities || []), ...newActivities],
        }));
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
          duration: drill.default_duration,
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
    [session.id, session.activities, addActivity, categories]
  );

  // Add custom activity
  const handleAddCustomActivity = useCallback(
    async (name: string, duration: number, categoryId?: string) => {
      const category = categories.find((c) => c.id === categoryId);

      if (session.id) {
        const result = await addActivity({
          session_id: session.id,
          sort_order: session.activities?.length || 0,
          name,
          duration,
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
        }
      } else {
        const newActivity: ActivityWithCategory = {
          id: `temp-${Date.now()}`,
          session_id: '',
          drill_id: null,
          name,
          duration,
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
    [session.id, session.activities, addActivity, categories]
  );

  // Open drill modal in single mode
  const openSingleDrillModal = useCallback(() => {
    setDrillModalMode('single');
    setIsDrillModalOpen(true);
  }, []);

  // Open drill modal in multi mode
  const openMultipleDrillModal = useCallback(() => {
    setDrillModalMode('multiple');
    setIsDrillModalOpen(true);
  }, []);

  const openPlayModalForActivity = useCallback((activityId: string) => {
    setTargetPlayActivityId(activityId);
    setIsPlayModalOpen(true);
  }, []);

  const closePlayModal = useCallback(() => {
    setTargetPlayActivityId(null);
    setIsPlayModalOpen(false);
  }, []);

  const handleAttachPlayToActivity = useCallback(
    async (play: Play) => {
      if (!targetPlayActivityId) return;

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
    [targetPlayActivityId, handleActivityUpdate, closePlayModal]
  );

  const handleClearLinkedPlay = useCallback(
    async (activityId: string) => {
      await handleActivityUpdate(activityId, {
        linked_play_id: null,
        linked_play_name_snapshot: null,
        linked_play_version_snapshot: null,
        linked_play_snapshot: null,
        linked_play_thumbnail_data_url: null,
      });
    },
    [handleActivityUpdate]
  );

  const handleRefreshPlaySnapshot = useCallback(
    async (activityId: string) => {
      const activity = (session.activities || []).find((item) => item.id === activityId);
      if (!activity?.linked_play_id) return;

      const latestPlay = (await getPlay(activity.linked_play_id)) || playsById[activity.linked_play_id];
      if (!latestPlay) {
        alert('The linked play no longer exists or cannot be accessed.');
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
    [session.activities, getPlay, playsById, handleActivityUpdate]
  );

  const handleViewLinkedPlay = useCallback(
    (activityId: string) => {
      const activity = (session.activities || []).find((item) => item.id === activityId);
      if (!activity?.linked_play_id) return;
      router.push(`/dashboard/plays/${activity.linked_play_id}`);
    },
    [session.activities, router]
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
      const existingActivities = session.activities || [];
      if (existingActivities.length > 0) {
        const shouldReplace = confirm(
          `Apply ${variant.label}? This will replace ${existingActivities.length} existing activities in this plan.`
        );
        if (!shouldReplace) {
          return;
        }
      }

      if (session.id) {
        // Persisted session: replace activities in the database.
        let didPersistAllChanges = true;

        for (const existing of existingActivities) {
          const deleteResult = await deleteActivity(existing.id);
          if (!deleteResult.success) {
            didPersistAllChanges = false;
          }
        }

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
            duration: generated.duration,
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
          alert(
            'Autopilot plan was partially applied. Some activity inserts failed. Please review and save again.'
          );
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
        duration: generated.duration,
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
    [session.activities, session.id, categories, deleteActivity, addActivity, drillCategoryIdsByDrillId]
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
          duration: activity.duration,
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
    if (!session.name?.trim()) {
      alert('Please enter a session name');
      return;
    }

    if (!currentTeam?.id) {
      alert('No team selected. Please select a team first.');
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
          alert(`Failed to save: ${updateResult.error || 'Unknown error'}`);
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
          alert(`Failed to create session: ${result.error || 'Unknown error'}`);
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
        alert(
          'Session details were saved, but one or more activities failed to save. Your local activities were kept so you can retry Save Plan.'
        );
        setHasUnsavedChanges(true);
        return;
      }

      if (!session.id && targetSessionId) {
        // Only navigate to edit route once all activities are persisted
        // so users never land on an empty activity list after save.
        router.replace(`/dashboard/sessions/${targetSessionId}`);
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Save error:', error);
      alert('An unexpected error occurred while saving. Check the console for details.');
    } finally {
      setIsSaving(false);
    }
  }, [session, currentTeam, createSession, updateSession, persistUnsavedActivities, router]);

  // Save as new (duplicate)
  const handleSaveAsNew = useCallback(async () => {
    const newName = prompt('Enter name for the new plan:', `${session.name} (Copy)`);
    if (!newName) return;

    if (session.id) {
      setIsSaving(true);
      const result = await duplicateSession(session.id, newName);
      if (result.success && result.session) {
        router.push(`/dashboard/sessions/${result.session.id}`);
      }
      setIsSaving(false);
    }
  }, [session.id, session.name, duplicateSession, router]);

  // Print session
  const handlePrint = useCallback(() => {
    if (!session.name) return;
    printSessionPlan(session as SessionWithActivities, currentTeam?.name || '', {
      categories,
      drillCategoryIdsByDrillId,
      appName: displayName,
    });
  }, [session, currentTeam, categories, drillCategoryIdsByDrillId, displayName]);

  const handleSaveActivitiesToLibrary = useCallback(async () => {
    const activities = (session.activities || []) as ActivityWithCategory[];
    if (activities.length === 0) {
      alert('No activities to save yet.');
      return;
    }

    setIsSavingActivitiesToLibrary(true);

    try {
      const existingDrills = await getDrills();
      const existingNames = new Set(
        existingDrills.map((drill) => drill.name.trim().toLowerCase()).filter(Boolean)
      );

      let createdCount = 0;
      let skippedCount = 0;
      let failedCreateCount = 0;
      const createdDrillByActivityId = new Map<string, string>();

      for (const activity of activities) {
        const normalizedName = activity.name.trim().toLowerCase();
        const alreadyLinked = Boolean(activity.drill_id);
        const duplicateName = existingNames.has(normalizedName);

        if (!normalizedName || alreadyLinked || duplicateName) {
          skippedCount += 1;
          continue;
        }

        const createResult = await createDrill({
          name: activity.name.trim(),
          category_id: activity.category_id || undefined,
          default_duration: activity.duration,
          description: activity.notes || undefined,
          notes: activity.notes || undefined,
          tags: buildDrillTags([], activity.additional_category_ids || []),
        });

        if (!createResult.success || !createResult.drill) {
          failedCreateCount += 1;
          continue;
        }

        createdCount += 1;
        existingNames.add(normalizedName);
        createdDrillByActivityId.set(activity.id, createResult.drill.id);
      }

      if (createdDrillByActivityId.size > 0) {
        setSession((prev) => ({
          ...prev,
          activities: (prev.activities || []).map((activity) =>
            createdDrillByActivityId.has(activity.id)
              ? { ...activity, drill_id: createdDrillByActivityId.get(activity.id) || activity.drill_id }
              : activity
          ),
        }));

        if (session.id) {
          for (const [activityId, drillId] of createdDrillByActivityId.entries()) {
            if (!activityId.startsWith('temp-')) {
              await updateActivity(activityId, { drill_id: drillId });
            }
          }
        } else {
          setHasUnsavedChanges(true);
        }
      }

      const summaryParts = [
        `Saved ${createdCount} activit${createdCount === 1 ? 'y' : 'ies'} to Drill Library.`,
      ];

      if (skippedCount > 0) {
        summaryParts.push(
          `${skippedCount} skipped (already linked or same-name drill exists).`
        );
      }
      if (failedCreateCount > 0) {
        summaryParts.push(`${failedCreateCount} failed to save.`);
      }

      await loadDrillCategoryContext();

      alert(summaryParts.join(' '));
    } catch (error) {
      console.error('Failed to save activities to drill library:', error);
      alert('Failed to save activities to Drill Library. Please try again.');
    } finally {
      setIsSavingActivitiesToLibrary(false);
    }
  }, [session.activities, session.id, getDrills, createDrill, updateActivity, loadDrillCategoryContext]);

  // Clear form
  const handleClear = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('Are you sure you want to clear the form? Unsaved changes will be lost.')) {
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
  }, [hasUnsavedChanges]);

  const activities = (session.activities || []) as ActivityWithCategory[];
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#f8fafc] p-4 pb-40 md:p-6 xl:p-8">
      <div className="space-y-4 md:hidden">
        <header className="flex items-center gap-3">
          <Link
            href="/dashboard/sessions"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-navy shadow-sm"
            aria-label="Back to sessions"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                  disabled={isSaving}
                  className="w-full min-w-0 bg-transparent text-[28px] font-bold tracking-[-0.04em] text-white outline-none placeholder:text-white/50 md:text-[30px] xl:max-w-[780px]"
                  placeholder="Tuesday Practice · Ball-screen emphasis"
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
                    disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
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
              {session.id && (
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
                disabled={isSaving || !session.name?.trim()}
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
            disabled={isSaving}
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
            disabled={isSaving}
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
            disabled={isSaving}
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
            disabled={isSaving}
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
              onClick={openMultipleDrillModal}
              disabled={isSaving}
            >
              + Custom
            </Button>
            <Button
              variant="accent"
              onClick={() => setShowAutopilot((previous) => !previous)}
              disabled={isSaving}
              className="bg-gradient-to-r from-teal to-teal-dark text-white hover:from-teal-dark hover:to-teal-dark"
            >
              <Sparkles className="h-4 w-4" />
              Autopilot
            </Button>
          </div>
        </div>

        {showAutopilot && (
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
          onAddMultipleDrillsClick={openMultipleDrillModal}
          onManageCategoriesClick={() => setIsCategoryManagerOpen(true)}
          onSaveActivitiesToLibrary={handleSaveActivitiesToLibrary}
          isSavingActivitiesToLibrary={isSavingActivitiesToLibrary}
          canManagePlayLinks={Boolean(canManagePlayLinks)}
          onAttachPlayClick={canManagePlayLinks ? openPlayModalForActivity : undefined}
          onClearPlayClick={canManagePlayLinks ? handleClearLinkedPlay : undefined}
          onRefreshPlaySnapshotClick={
            canManagePlayLinks ? handleRefreshPlaySnapshot : undefined
          }
          onViewLinkedPlayClick={handleViewLinkedPlay}
          linkedPlayIsStale={isLinkedPlayStale}
          disabled={isSaving}
        />
      </section>

      <div className="hidden flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex">
        <Button variant="outline" onClick={handleClear} disabled={isSaving}>
          Clear form
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

      <MobileStickyActionBar>
        <button
          type="button"
          onClick={openSingleDrillModal}
          disabled={isSaving}
          className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-teal bg-white px-4 text-base font-extrabold text-teal disabled:opacity-50"
        >
          + Add Activity
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !session.name?.trim()}
          className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-navy px-4 text-base font-extrabold text-white disabled:opacity-50"
        >
          <Save className="h-5 w-5" />
          {isSaving ? 'Saving' : 'Save Plan'}
        </button>
      </MobileStickyActionBar>

      {/* Drill Selector Modal */}
      <DrillSelectorModal
        isOpen={isDrillModalOpen}
        onClose={() => setIsDrillModalOpen(false)}
        onSelect={handleAddDrill}
        onSelectMultiple={handleAddMultipleDrills}
        onAddCustom={handleAddCustomActivity}
        categories={categories}
        mode={drillModalMode}
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
    </div>
  );
}
