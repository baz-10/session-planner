'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type { Team, TeamRole, CreateTeamInput } from '@/types/database';

const PUBLIC_INVITE_ROLES = new Set<TeamRole>(['player', 'parent']);

interface JoinTeamResult {
  success: boolean;
  team?: Team;
  error?: string;
}

interface CreateTeamResult {
  success: boolean;
  team?: Team;
  error?: string;
}

export function useTeam() {
  const { user, refreshTeamMemberships, setCurrentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();

  /**
   * Join a team using an invite code
   */
  const joinTeamByCode = useCallback(
    async (teamCode: string, role: TeamRole = 'player'): Promise<JoinTeamResult> => {
      if (!user) {
        return { success: false, error: 'You must be logged in to join a team' };
      }

      if (!PUBLIC_INVITE_ROLES.has(role)) {
        return {
          success: false,
          error: 'Invite codes can only add players or parents. Ask a team admin to promote coaches.',
        };
      }

      const { data: team, error: joinError } = await supabase.rpc('join_team_by_code', {
        invite_code: teamCode.toUpperCase(),
        requested_role: role,
      });

      if (joinError) {
        console.error('Error joining team:', joinError);
        const message = joinError.message || '';
        if (message.toLowerCase().includes('invalid team code')) {
          return { success: false, error: 'Invalid team code. Please check and try again.' };
        }
        if (message.toLowerCase().includes('invite codes can only add')) {
          return { success: false, error: message };
        }
        return { success: false, error: 'Failed to join team. Please try again.' };
      }

      // Refresh team memberships
      await refreshTeamMemberships();
      setCurrentTeam(team as Team);

      return { success: true, team: team as Team };
    },
    [user, supabase, refreshTeamMemberships, setCurrentTeam]
  );

  /**
   * Create a new team
   */
  const createTeam = useCallback(
    async (input: CreateTeamInput): Promise<CreateTeamResult> => {
      if (!user) {
        return { success: false, error: 'You must be logged in to create a team' };
      }

      const { data: team, error } = await supabase
        .from('teams')
        .insert({
          name: input.name,
          organization_id: input.organization_id || null,
          sport: input.sport || 'basketball',
          logo_url: input.logo_url || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error || !team) {
        console.error('Error creating team:', error);
        return { success: false, error: 'Failed to create team. Please try again.' };
      }

      // Refresh team memberships (trigger will have added user as admin)
      await refreshTeamMemberships();
      setCurrentTeam(team as Team);

      return { success: true, team: team as Team };
    },
    [user, supabase, refreshTeamMemberships, setCurrentTeam]
  );

  /**
   * Update team settings
   */
  const updateTeam = useCallback(
    async (teamId: string, updates: Partial<Team>): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'You must be logged in' };
      }

      const { error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId);

      if (error) {
        console.error('Error updating team:', error);
        return { success: false, error: 'Failed to update team.' };
      }

      await refreshTeamMemberships();
      return { success: true };
    },
    [user, supabase, refreshTeamMemberships]
  );

  /**
   * Leave a team
   */
  const leaveTeam = useCallback(
    async (teamId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'You must be logged in' };
      }

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error leaving team:', error);
        return { success: false, error: 'Failed to leave team.' };
      }

      await refreshTeamMemberships();
      return { success: true };
    },
    [user, supabase, refreshTeamMemberships]
  );

  /**
   * Get team members
   */
  const getTeamMembers = useCallback(
    async (teamId: string): Promise<{ success: boolean; members?: any[]; error?: string }> => {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq('team_id', teamId)
        .order('role', { ascending: true });

      if (error) {
        console.error('Error fetching team members:', error);
        return { success: false, error: 'Failed to load team members' };
      }

      return { success: true, members: data || [] };
    },
    [supabase]
  );

  /**
   * Update a team member's role
   */
  const updateMemberRole = useCallback(
    async (
      teamId: string,
      memberId: string,
      role: TeamRole
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('team_id', teamId)
        .eq('id', memberId);

      if (error) {
        console.error('Error updating member role:', error);
        return { success: false, error: 'Failed to update member role.' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Remove a member from a team
   */
  const removeMember = useCallback(
    async (teamId: string, memberId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('id', memberId);

      if (error) {
        console.error('Error removing member:', error);
        return { success: false, error: 'Failed to remove member.' };
      }

      return { success: true };
    },
    [supabase]
  );

  return {
    joinTeamByCode,
    createTeam,
    updateTeam,
    leaveTeam,
    getTeamMembers,
    updateMemberRole,
    removeMember,
  };
}
