'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type {
  CreatePlayInput,
  Play,
  UpdatePlayInput,
} from '@/types/database';
import type { CourtTemplate, PlayType } from '@/lib/plays/diagram-types';

interface PlayFilters {
  playType?: PlayType;
  courtTemplate?: CourtTemplate;
  tag?: string;
}

interface PlayReadOptions {
  throwOnError?: boolean;
}

const STALE_PLAY_ERROR = 'Play access changed. Refresh the library and try again.';

export function usePlays() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  const getPlays = useCallback(
    async (filters: PlayFilters = {}, options: PlayReadOptions = {}): Promise<Play[]> => {
      if (!currentTeam) return [];

      let query = supabase
        .from('plays')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('updated_at', { ascending: false });

      if (filters.playType) {
        query = query.eq('play_type', filters.playType);
      }

      if (filters.courtTemplate) {
        query = query.eq('court_template', filters.courtTemplate);
      }

      if (filters.tag) {
        query = query.contains('tags', [filters.tag]);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching plays:', error);
        if (options.throwOnError) {
          throw new Error('Failed to load play library.');
        }
        return [];
      }

      return (data || []) as Play[];
    },
    [supabase, currentTeam]
  );

  const getPlay = useCallback(
    async (playId: string): Promise<Play | null> => {
      if (!currentTeam) return null;

      const { data, error } = await supabase
        .from('plays')
        .select('*')
        .eq('id', playId)
        .eq('team_id', currentTeam.id)
        .single();

      if (error || !data) {
        console.error('Error fetching play:', error);
        return null;
      }

      return data as Play;
    },
    [supabase, currentTeam]
  );

  const createPlay = useCallback(
    async (input: CreatePlayInput): Promise<{ success: boolean; play?: Play; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated or no team selected' };
      }

      if (input.team_id && input.team_id !== currentTeam.id) {
        return { success: false, error: 'Select the target team before creating this play.' };
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('plays')
        .insert({
          team_id: currentTeam.id,
          organization_id: input.organization_id || null,
          name: input.name,
          description: input.description || null,
          play_type: input.play_type || 'offense',
          court_template: input.court_template || 'half_court',
          tags: input.tags || [],
          diagram: input.diagram,
          thumbnail_data_url: input.thumbnail_data_url || null,
          version: input.version || 1,
          created_by: user.id,
        })
        .select()
        .single();
      setIsLoading(false);

      if (error || !data) {
        console.error('Error creating play:', error);
        return { success: false, error: error?.message || 'Failed to create play' };
      }

      return { success: true, play: data as Play };
    },
    [user, currentTeam, supabase]
  );

  const updatePlay = useCallback(
    async (playId: string, updates: UpdatePlayInput): Promise<{ success: boolean; error?: string }> => {
      if (!currentTeam) {
        return { success: false, error: 'Select a team before updating this play.' };
      }

      setIsLoading(true);
      const { error, count } = await supabase
        .from('plays')
        .update(updates, { count: 'exact' })
        .eq('id', playId)
        .eq('team_id', currentTeam.id);
      setIsLoading(false);

      if (error) {
        console.error('Error updating play:', error);
        return { success: false, error: error.message || 'Failed to update play' };
      }

      if (count === 0) {
        return { success: false, error: STALE_PLAY_ERROR };
      }

      return { success: true };
    },
    [supabase, currentTeam]
  );

  const deletePlay = useCallback(
    async (playId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentTeam) {
        return { success: false, error: 'Select a team before deleting this play.' };
      }

      const { error, count } = await supabase
        .from('plays')
        .delete({ count: 'exact' })
        .eq('id', playId)
        .eq('team_id', currentTeam.id);

      if (error) {
        console.error('Error deleting play:', error);
        return { success: false, error: error.message || 'Failed to delete play' };
      }

      if (count === 0) {
        return { success: false, error: STALE_PLAY_ERROR };
      }

      return { success: true };
    },
    [supabase, currentTeam]
  );

  const duplicatePlay = useCallback(
    async (playId: string, newName?: string): Promise<{ success: boolean; play?: Play; error?: string }> => {
      const source = await getPlay(playId);
      if (!source) {
        return { success: false, error: 'Play not found' };
      }

      return createPlay({
        name: newName || `${source.name} (Copy)`,
        description: source.description || undefined,
        play_type: source.play_type,
        court_template: source.court_template,
        tags: source.tags || [],
        diagram: source.diagram,
        thumbnail_data_url: source.thumbnail_data_url,
        version: 1,
      });
    },
    [getPlay, createPlay]
  );

  const searchPlays = useCallback(
    async (queryText: string, options: PlayReadOptions = {}): Promise<Play[]> => {
      const normalized = queryText.trim().toLowerCase();
      if (!normalized) return [];

      const plays = await getPlays({}, options);
      return plays.filter((play) => {
        const searchable = [play.name, play.description || '', (play.tags || []).join(' ')].join(' ').toLowerCase();
        return searchable.includes(normalized);
      });
    },
    [getPlays]
  );

  return {
    isLoading,
    getPlays,
    getPlay,
    createPlay,
    updatePlay,
    deletePlay,
    duplicatePlay,
    searchPlays,
  };
}
