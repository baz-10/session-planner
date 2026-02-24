'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useSessions } from '@/hooks/use-sessions';
import { useDrills } from '@/hooks/use-drills';
import { usePlays } from '@/hooks/use-plays';
import { useBranding } from '@/hooks/use-branding';
import { SessionMetadataForm } from './session-metadata-form';
import { ActivityTable } from './activity-table';
import { TimeAllocationChart } from './time-allocation-chart';
import { DrillSelectorModal } from './drill-selector-modal';
import { PlaySelectorModal } from './play-selector-modal';
import { SessionAutopilotPanel } from './session-autopilot-panel';
import { CategoryManager } from '@/components/drills/category-manager';
import { printSessionPlan } from '@/lib/utils/pdf-export';
import { buildDrillTags, getAdditionalCategoryIdsFromTags } from '@/lib/utils/drill-tags';
import type { Session, SessionActivity, DrillCategory, Drill, Play } from '@/types/database';
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // Keep drill/category data aligned with whichever team is currently selected.
  useEffect(() => {
    void Promise.all([loadCategories(), loadDrillCategoryContext(), loadPlayContext()]);
  }, [currentTeam?.id, loadCategories, loadDrillCategoryContext, loadPlayContext]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Create New Plan' : 'Update Plan'}
        </h1>
        {hasUnsavedChanges && (
          <span className="text-sm text-orange-600">Unsaved changes</span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Metadata Form */}
        <div className="lg:col-span-2">
          <SessionMetadataForm
            session={session}
            onChange={handleMetadataChange}
            disabled={isSaving}
          />
        </div>

        {/* Right: Time Allocation Chart */}
        <div>
          <TimeAllocationChart
            activities={session.activities || []}
            totalDuration={session.duration || 90}
            categories={categories}
            drillCategoryIdsByDrillId={drillCategoryIdsByDrillId}
          />
        </div>
      </div>

      {/* Activity Table */}
      <SessionAutopilotPanel
        teamId={currentTeam?.id}
        sessionContext={{
          sessionName: session.name,
          durationMinutes: session.duration || undefined,
          offensiveEmphasis: session.offensive_emphasis,
          defensiveEmphasis: session.defensive_emphasis,
          existingActivities: (session.activities || []).map((activity) => ({
            name: activity.name,
            duration: Number(activity.duration) || 0,
          })),
        }}
        disabled={isSaving}
        onApplyVariant={handleApplyAutopilotVariant}
      />

      {/* Activity Table */}
      <ActivityTable
        activities={session.activities || []}
        sessionStartTime={session.start_time || '17:00'}
        totalDuration={session.duration || 90}
        categories={categories}
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
        onRefreshPlaySnapshotClick={canManagePlayLinks ? handleRefreshPlaySnapshot : undefined}
        onViewLinkedPlayClick={handleViewLinkedPlay}
        linkedPlayIsStale={isLinkedPlayStale}
        disabled={isSaving}
      />

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 py-4 border-t border-gray-200">
        <button
          onClick={handleClear}
          disabled={isSaving}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Clear Form
        </button>
        <button
          onClick={handlePrint}
          disabled={isSaving || !session.name}
          className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50"
        >
          Print Plan
        </button>
        {session.id && (
          <button
            onClick={handleSaveAsNew}
            disabled={isSaving}
            className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50"
          >
            Save as New Plan
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || !session.name?.trim()}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>

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
