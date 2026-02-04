'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type {
  Player,
  CreatePlayerInput,
  RelationshipType,
  ParentPlayerLink,
} from '@/types/database';

interface CreatePlayerResult {
  success: boolean;
  player?: Player;
  error?: string;
}

interface LinkPlayerResult {
  success: boolean;
  link?: ParentPlayerLink;
  error?: string;
}

export function usePlayers() {
  const { user, refreshLinkedPlayers } = useAuth();
  const supabase = getBrowserSupabaseClient();

  /**
   * Create a new player (for parents adding their children)
   */
  const createPlayer = useCallback(
    async (input: CreatePlayerInput): Promise<CreatePlayerResult> => {
      if (!user) {
        return { success: false, error: 'You must be logged in to add a player' };
      }

      const { data: player, error } = await supabase
        .from('players')
        .insert({
          team_id: input.team_id,
          first_name: input.first_name,
          last_name: input.last_name,
          jersey_number: input.jersey_number || null,
          position: input.position || null,
          grade: input.grade || null,
          birth_date: input.birth_date || null,
          status: 'active',
          created_by: user.id,
        })
        .select()
        .single();

      if (error || !player) {
        console.error('Error creating player:', error);
        return { success: false, error: 'Failed to add player. Please try again.' };
      }

      return { success: true, player: player as Player };
    },
    [user, supabase]
  );

  /**
   * Create a player and automatically link to the current user as parent
   */
  const createPlayerWithLink = useCallback(
    async (
      input: CreatePlayerInput,
      relationship: RelationshipType = 'parent'
    ): Promise<CreatePlayerResult & { link?: ParentPlayerLink }> => {
      if (!user) {
        return { success: false, error: 'You must be logged in to add a player' };
      }

      // Create the player
      const createResult = await createPlayer(input);
      if (!createResult.success || !createResult.player) {
        return createResult;
      }

      // Create the parent-player link
      const { data: link, error: linkError } = await supabase
        .from('parent_player_links')
        .insert({
          parent_user_id: user.id,
          player_id: createResult.player.id,
          relationship,
          can_rsvp: true,
          receives_notifications: true,
        })
        .select()
        .single();

      if (linkError) {
        console.error('Error linking player:', linkError);
        // Player was created but linking failed
        return {
          success: true,
          player: createResult.player,
          error: 'Player created but linking failed.',
        };
      }

      // Refresh linked players
      await refreshLinkedPlayers();

      return {
        success: true,
        player: createResult.player,
        link: link as ParentPlayerLink,
      };
    },
    [user, supabase, createPlayer, refreshLinkedPlayers]
  );

  /**
   * Link an existing player to the current user as parent
   */
  const linkPlayer = useCallback(
    async (
      playerId: string,
      relationship: RelationshipType = 'parent'
    ): Promise<LinkPlayerResult> => {
      if (!user) {
        return { success: false, error: 'You must be logged in' };
      }

      // Check if already linked
      const { data: existing } = await supabase
        .from('parent_player_links')
        .select('id')
        .eq('parent_user_id', user.id)
        .eq('player_id', playerId)
        .single();

      if (existing) {
        return { success: false, error: 'You are already linked to this player.' };
      }

      const { data: link, error } = await supabase
        .from('parent_player_links')
        .insert({
          parent_user_id: user.id,
          player_id: playerId,
          relationship,
          can_rsvp: true,
          receives_notifications: true,
        })
        .select()
        .single();

      if (error || !link) {
        console.error('Error linking player:', error);
        return { success: false, error: 'Failed to link player.' };
      }

      await refreshLinkedPlayers();
      return { success: true, link: link as ParentPlayerLink };
    },
    [user, supabase, refreshLinkedPlayers]
  );

  /**
   * Unlink a player from the current user
   */
  const unlinkPlayer = useCallback(
    async (playerId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'You must be logged in' };
      }

      const { error } = await supabase
        .from('parent_player_links')
        .delete()
        .eq('parent_user_id', user.id)
        .eq('player_id', playerId);

      if (error) {
        console.error('Error unlinking player:', error);
        return { success: false, error: 'Failed to unlink player.' };
      }

      await refreshLinkedPlayers();
      return { success: true };
    },
    [user, supabase, refreshLinkedPlayers]
  );

  /**
   * Update player information
   */
  const updatePlayer = useCallback(
    async (
      playerId: string,
      updates: Partial<Player>
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('players')
        .update(updates)
        .eq('id', playerId);

      if (error) {
        console.error('Error updating player:', error);
        return { success: false, error: 'Failed to update player.' };
      }

      await refreshLinkedPlayers();
      return { success: true };
    },
    [supabase, refreshLinkedPlayers]
  );

  /**
   * Get players for a team
   */
  const getTeamPlayers = useCallback(
    async (teamId: string) => {
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          parent_links:parent_player_links(
            *,
            parent:profiles(*)
          )
        `)
        .eq('team_id', teamId);

      if (error) {
        console.error('Error fetching team players:', error);
        return [];
      }

      return data || [];
    },
    [supabase]
  );

  /**
   * Update parent-player link settings
   */
  const updateLinkSettings = useCallback(
    async (
      linkId: string,
      updates: { can_rsvp?: boolean; receives_notifications?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('parent_player_links')
        .update(updates)
        .eq('id', linkId);

      if (error) {
        console.error('Error updating link settings:', error);
        return { success: false, error: 'Failed to update settings.' };
      }

      await refreshLinkedPlayers();
      return { success: true };
    },
    [supabase, refreshLinkedPlayers]
  );

  return {
    createPlayer,
    createPlayerWithLink,
    linkPlayer,
    unlinkPlayer,
    updatePlayer,
    getTeamPlayers,
    updateLinkSettings,
  };
}
