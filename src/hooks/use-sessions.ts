'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type {
  Session,
  SessionActivity,
  CreateSessionInput,
  CreateActivityInput,
  DrillCategory,
  TeamRole,
} from '@/types/database';

interface SessionWithActivities extends Session {
  activities: (SessionActivity & { category?: DrillCategory | null })[];
}

function isLegacySessionActivityColumnError(error: { message?: string | null } | null): boolean {
  if (!error?.message) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes('additional_category_ids') && message.includes('column')) ||
    (message.includes('linked_play_') && message.includes('column'))
  );
}

export function useSessions() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Get all sessions for the current team
   */
  const getSessions = useCallback(async () => {
    if (!currentTeam) return [];

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('team_id', currentTeam.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }

    return data as Session[];
  }, [supabase, currentTeam]);

  /**
   * Get a single session with all activities
   */
  const getSession = useCallback(
    async (sessionId: string): Promise<SessionWithActivities | null> => {
      const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        console.error('Error fetching session:', error);
        return null;
      }

      const { data: activities, error: activitiesError } = await supabase
        .from('session_activities')
        .select(`
          *,
          category:drill_categories(*)
        `)
        .eq('session_id', sessionId)
        .order('sort_order', { ascending: true });

      if (activitiesError) {
        console.error('Error fetching activities with category join:', activitiesError);

        // Fallback: if relation metadata is stale/missing, fetch activities without the category join
        // so plans still load instead of appearing empty.
        const { data: fallbackActivities, error: fallbackError } = await supabase
          .from('session_activities')
          .select('*')
          .eq('session_id', sessionId)
          .order('sort_order', { ascending: true });

        if (fallbackError) {
          console.error('Error fetching activities (fallback):', fallbackError);
          return { ...session, activities: [] } as SessionWithActivities;
        }

        return {
          ...session,
          activities: fallbackActivities || [],
        } as SessionWithActivities;
      }

      return {
        ...session,
        activities: activities || [],
      } as SessionWithActivities;
    },
    [supabase]
  );

  /**
   * Create a new session
   */
  const createSession = useCallback(
    async (input: CreateSessionInput): Promise<{ success: boolean; session?: Session; error?: string }> => {
      const targetTeamId = input.team_id || currentTeam?.id;
      console.log('[createSession] Starting...', {
        hasUser: !!user,
        hasCurrentTeam: !!currentTeam,
        currentTeamId: currentTeam?.id,
        targetTeamId,
      });

      if (!user || !targetTeamId) {
        console.log('[createSession] Missing user or target team');
        return { success: false, error: 'Not authenticated or no team selected' };
      }

      setIsLoading(true);

      try {
        const { data: membershipData, error: membershipError } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', targetTeamId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (membershipError) {
          setIsLoading(false);
          console.error('[createSession] Failed to verify membership:', membershipError);
          return { success: false, error: 'Unable to verify your team permissions. Please try again.' };
        }

        const membership = membershipData as { role: TeamRole } | null;
        const canManageSessions = membership?.role === 'admin' || membership?.role === 'coach';
        if (!canManageSessions) {
          setIsLoading(false);
          return { success: false, error: 'Only coaches or admins can create session plans for this team.' };
        }

        console.log('[createSession] Inserting session for team:', targetTeamId);

        // Add timeout to prevent infinite hanging
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database operation timed out after 30 seconds')), 30000)
        );

        const insertPromise = supabase
          .from('sessions')
          .insert({
            team_id: targetTeamId,
            name: input.name,
            date: input.date || null,
            start_time: input.start_time || null,
            duration: input.duration || null,
            location: input.location || null,
            defensive_emphasis: input.defensive_emphasis || null,
            offensive_emphasis: input.offensive_emphasis || null,
            quote: input.quote || null,
            announcements: input.announcements || null,
            is_template: input.is_template || false,
            created_by: user.id,
          })
          .select()
          .single();

        const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

        setIsLoading(false);
        console.log('[createSession] Result:', { success: !error, error, hasData: !!data });

        if (error || !data) {
          console.error('[createSession] Error:', error);
          const isRlsError = error?.code === '42501' || error?.message?.toLowerCase().includes('row-level security');
          const errorMessage = isRlsError
            ? 'Only coaches or admins can create session plans for this team.'
            : error?.message || error?.code || 'Failed to create session';
          return { success: false, error: errorMessage };
        }

        console.log('[createSession] Success! Session ID:', data.id);
        return { success: true, session: data as Session };
      } catch (err) {
        setIsLoading(false);
        console.error('[createSession] Exception:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        return { success: false, error: errorMessage };
      }
    },
    [user, currentTeam, supabase]
  );

  /**
   * Update a session
   */
  const updateSession = useCallback(
    async (
      sessionId: string,
      updates: Partial<Session>
    ): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      const { error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', sessionId);

      setIsLoading(false);

      if (error) {
        console.error('Error updating session:', error);
        return { success: false, error: 'Failed to update session' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Delete a session
   */
  const deleteSession = useCallback(
    async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId);

      if (error) {
        console.error('Error deleting session:', error);
        return { success: false, error: 'Failed to delete session' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Duplicate a session
   */
  const duplicateSession = useCallback(
    async (sessionId: string, newName?: string): Promise<{ success: boolean; session?: Session; error?: string }> => {
      const session = await getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Create the new session
      const result = await createSession({
        team_id: session.team_id,
        name: newName || `${session.name} (Copy)`,
        date: session.date || undefined,
        start_time: session.start_time || undefined,
        duration: session.duration || undefined,
        location: session.location || undefined,
        defensive_emphasis: session.defensive_emphasis || undefined,
        offensive_emphasis: session.offensive_emphasis || undefined,
        quote: session.quote || undefined,
        announcements: session.announcements || undefined,
        is_template: session.is_template,
      });

      if (!result.success || !result.session) {
        return result;
      }

      // Copy all activities
      if (session.activities.length > 0) {
        const activitiesToInsert = session.activities.map((activity) => ({
          session_id: result.session!.id,
          drill_id: activity.drill_id,
          sort_order: activity.sort_order,
          name: activity.name,
          duration: activity.duration,
          category_id: activity.category_id,
          additional_category_ids: activity.additional_category_ids || [],
          notes: activity.notes,
          groups: activity.groups,
          linked_play_id: activity.linked_play_id || null,
          linked_play_name_snapshot: activity.linked_play_name_snapshot || null,
          linked_play_version_snapshot: activity.linked_play_version_snapshot || null,
          linked_play_snapshot: activity.linked_play_snapshot || null,
          linked_play_thumbnail_data_url: activity.linked_play_thumbnail_data_url || null,
        }));

        const { error: insertError } = await supabase.from('session_activities').insert(activitiesToInsert);
        if (insertError && isLegacySessionActivityColumnError(insertError)) {
          const legacyActivitiesToInsert = activitiesToInsert.map((activity) => {
            // Remove columns unavailable in legacy schemas.
            const {
              additional_category_ids: _ignoredAdditionalCategoryIds,
              linked_play_id: _ignoredLinkedPlayId,
              linked_play_name_snapshot: _ignoredLinkedPlayNameSnapshot,
              linked_play_version_snapshot: _ignoredLinkedPlayVersionSnapshot,
              linked_play_snapshot: _ignoredLinkedPlaySnapshot,
              linked_play_thumbnail_data_url: _ignoredLinkedPlayThumbnailDataUrl,
              ...legacyActivity
            } = activity;
            return legacyActivity;
          });
          await supabase.from('session_activities').insert(legacyActivitiesToInsert);
        }
      }

      return result;
    },
    [getSession, createSession, supabase]
  );

  /**
   * Add an activity to a session
   */
  const addActivity = useCallback(
    async (input: CreateActivityInput): Promise<{ success: boolean; activity?: SessionActivity; error?: string }> => {
      const additionalCategoryIds = input.additional_category_ids || [];
      const payload = {
        session_id: input.session_id,
        drill_id: input.drill_id || null,
        sort_order: input.sort_order,
        name: input.name,
        duration: input.duration,
        category_id: input.category_id || null,
        additional_category_ids: additionalCategoryIds,
        notes: input.notes || null,
        groups: input.groups || [],
        linked_play_id: input.linked_play_id || null,
        linked_play_name_snapshot: input.linked_play_name_snapshot || null,
        linked_play_version_snapshot: input.linked_play_version_snapshot || null,
        linked_play_snapshot: input.linked_play_snapshot || null,
        linked_play_thumbnail_data_url: input.linked_play_thumbnail_data_url || null,
      };

      let { data, error } = await supabase
        .from('session_activities')
        .insert(payload)
        .select()
        .single();

      if (error && isLegacySessionActivityColumnError(error)) {
        const {
          additional_category_ids: _ignoredAdditionalCategoryIds,
          linked_play_id: _ignoredLinkedPlayId,
          linked_play_name_snapshot: _ignoredLinkedPlayNameSnapshot,
          linked_play_version_snapshot: _ignoredLinkedPlayVersionSnapshot,
          linked_play_snapshot: _ignoredLinkedPlaySnapshot,
          linked_play_thumbnail_data_url: _ignoredLinkedPlayThumbnailDataUrl,
          ...legacyPayload
        } = payload;
        const retryResult = await supabase
          .from('session_activities')
          .insert(legacyPayload)
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error || !data) {
        console.error('Error adding activity:', error);
        return { success: false, error: error?.message || 'Failed to add activity' };
      }

      return { success: true, activity: data as SessionActivity };
    },
    [supabase]
  );

  /**
   * Update an activity
   */
  const updateActivity = useCallback(
    async (
      activityId: string,
      updates: Partial<SessionActivity>
    ): Promise<{ success: boolean; error?: string }> => {
      let { error } = await supabase
        .from('session_activities')
        .update(updates)
        .eq('id', activityId);

      if (error && isLegacySessionActivityColumnError(error)) {
        const {
          additional_category_ids: _ignoredAdditionalCategoryIds,
          linked_play_id: _ignoredLinkedPlayId,
          linked_play_name_snapshot: _ignoredLinkedPlayNameSnapshot,
          linked_play_version_snapshot: _ignoredLinkedPlayVersionSnapshot,
          linked_play_snapshot: _ignoredLinkedPlaySnapshot,
          linked_play_thumbnail_data_url: _ignoredLinkedPlayThumbnailDataUrl,
          ...legacyUpdates
        } = updates;
        const retryResult = await supabase
          .from('session_activities')
          .update(legacyUpdates)
          .eq('id', activityId);
        error = retryResult.error;
      }

      if (error) {
        console.error('Error updating activity:', error);
        return { success: false, error: 'Failed to update activity' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Delete an activity
   */
  const deleteActivity = useCallback(
    async (activityId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase.from('session_activities').delete().eq('id', activityId);

      if (error) {
        console.error('Error deleting activity:', error);
        return { success: false, error: 'Failed to delete activity' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Reorder activities (update sort_order for all activities)
   */
  const reorderActivities = useCallback(
    async (
      sessionId: string,
      activityIds: string[]
    ): Promise<{ success: boolean; error?: string }> => {
      // Update each activity with its new sort_order
      const updates = activityIds.map((id, index) => ({
        id,
        sort_order: index,
      }));

      // Use a transaction-like approach by updating all in parallel
      const promises = updates.map(({ id, sort_order }) =>
        supabase
          .from('session_activities')
          .update({ sort_order })
          .eq('id', id)
          .eq('session_id', sessionId)
      );

      const results = await Promise.all(promises);
      const hasError = results.some((r) => r.error);

      if (hasError) {
        console.error('Error reordering activities');
        return { success: false, error: 'Failed to reorder activities' };
      }

      return { success: true };
    },
    [supabase]
  );

  return {
    isLoading,
    getSessions,
    getSession,
    createSession,
    updateSession,
    deleteSession,
    duplicateSession,
    addActivity,
    updateActivity,
    deleteActivity,
    reorderActivities,
  };
}
