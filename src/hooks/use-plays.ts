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

export function usePlays() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  const getPlays = useCallback(
    async (filters: PlayFilters = {}): Promise<Play[]> => {
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
        return [];
      }

      return (data || []) as Play[];
    },
    [supabase, currentTeam]
  );

  const getPlay = useCallback(
    async (playId: string): Promise<Play | null> => {
      const { data, error } = await supabase
        .from('plays')
        .select('*')
        .eq('id', playId)
        .single();

      if (error || !data) {
        console.error('Error fetching play:', error);
        return null;
      }

      return data as Play;
    },
    [supabase]
  );

  const createPlay = useCallback(
    async (input: CreatePlayInput): Promise<{ success: boolean; play?: Play; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated or no team selected' };
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('plays')
        .insert({
          team_id: input.team_id || currentTeam.id,
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
      setIsLoading(true);
      const { error } = await supabase
        .from('plays')
        .update(updates)
        .eq('id', playId);
      setIsLoading(false);

      if (error) {
        console.error('Error updating play:', error);
        return { success: false, error: error.message || 'Failed to update play' };
      }

      return { success: true };
    },
    [supabase]
  );

  const deletePlay = useCallback(
    async (playId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('plays')
        .delete()
        .eq('id', playId);

      if (error) {
        console.error('Error deleting play:', error);
        return { success: false, error: error.message || 'Failed to delete play' };
      }

      return { success: true };
    },
    [supabase]
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
    async (queryText: string): Promise<Play[]> => {
      const normalized = queryText.trim().toLowerCase();
      if (!normalized) return [];

      const plays = await getPlays();
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
