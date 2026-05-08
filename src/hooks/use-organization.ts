'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import {
  normalizeOrganizationCode,
  ORGANIZATION_CODE_LENGTH,
} from '@/lib/utils/organization-code';
import type { Organization, OrgRole, Team } from '@/types/database';

interface OrganizationMemberWithProfile {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface CreateOrganizationResult {
  success: boolean;
  organization?: Organization;
  error?: string;
}

interface JoinOrganizationResult {
  success: boolean;
  organization?: Organization;
  error?: string;
}

const STALE_ORG_MEMBER_ERROR =
  'This organization member could not be updated. They may have been removed or your access may have changed.';

export function useOrganization() {
  const { user, refreshOrganizationMemberships, setCurrentOrganization } = useAuth();
  const supabase = getBrowserSupabaseClient();

  /**
   * Create a new organization
   */
  const createOrganization = useCallback(
    async (name: string, logoUrl?: string): Promise<CreateOrganizationResult> => {
      if (!user) {
        return { success: false, error: 'You must be logged in to create an organization' };
      }

      // Create the organization
      const { data: org, error: createError } = await supabase
        .from('organizations')
        .insert({
          name,
          logo_url: logoUrl || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError || !org) {
        console.error('Error creating organization:', createError);
        return { success: false, error: 'Failed to create organization. Please try again.' };
      }

      // The database trigger adds the creator as an organization admin.
      await refreshOrganizationMemberships();
      setCurrentOrganization(org as Organization);

      return { success: true, organization: org as Organization };
    },
    [user, supabase, refreshOrganizationMemberships, setCurrentOrganization]
  );

  /**
   * Join an organization by invite code. Invite codes add members only; admins
   * can promote trusted users after they join.
   */
  const joinOrganization = useCallback(
    async (inviteCode: string): Promise<JoinOrganizationResult> => {
      if (!user) {
        return { success: false, error: 'You must be logged in to join an organization' };
      }

      const normalizedCode = normalizeOrganizationCode(inviteCode);
      if (normalizedCode.length !== ORGANIZATION_CODE_LENGTH) {
        return { success: false, error: 'Please enter a valid 8-character organization invite code.' };
      }

      const { data: org, error: joinError } = await supabase.rpc('join_organization_by_code', {
        invite_code: normalizedCode,
      });

      if (joinError) {
        console.error('Error joining organization:', joinError);
        return {
          success: false,
          error: joinError.message || 'Failed to join organization. Please check the invite code.',
        };
      }

      await refreshOrganizationMemberships();
      setCurrentOrganization(org as Organization);

      return { success: true, organization: org as Organization };
    },
    [user, supabase, refreshOrganizationMemberships, setCurrentOrganization]
  );

  /**
   * Update organization settings
   */
  const updateOrganization = useCallback(
    async (
      organizationId: string,
      updates: Partial<Pick<Organization, 'name' | 'logo_url' | 'settings'>>
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'You must be logged in' };
      }

      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organizationId);

      if (error) {
        console.error('Error updating organization:', error);
        return { success: false, error: 'Failed to update organization.' };
      }

      await refreshOrganizationMemberships();
      return { success: true };
    },
    [user, supabase, refreshOrganizationMemberships]
  );

  /**
   * Leave an organization
   */
  const leaveOrganization = useCallback(
    async (organizationId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'You must be logged in' };
      }

      const { error, count } = await supabase
        .from('organization_members')
        .delete({ count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error leaving organization:', error);
        return { success: false, error: 'Failed to leave organization.' };
      }

      if (count === 0) {
        return { success: false, error: STALE_ORG_MEMBER_ERROR };
      }

      await refreshOrganizationMemberships();
      return { success: true };
    },
    [user, supabase, refreshOrganizationMemberships]
  );

  /**
   * Get organization members
   */
  const getOrganizationMembers = useCallback(
    async (
      organizationId: string
    ): Promise<{ success: boolean; members?: OrganizationMemberWithProfile[]; error?: string }> => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(
          `
          *,
          profile:profiles(id, email, full_name, avatar_url)
        `
        )
        .eq('organization_id', organizationId)
        .order('role', { ascending: true });

      if (error) {
        console.error('Error fetching organization members:', error);
        return { success: false, error: 'Failed to load organization members' };
      }

      return { success: true, members: (data || []) as OrganizationMemberWithProfile[] };
    },
    [supabase]
  );

  /**
   * Get teams in an organization
   */
  const getOrganizationTeams = useCallback(
    async (organizationId: string): Promise<{ success: boolean; teams?: Team[]; error?: string }> => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching organization teams:', error);
        return { success: false, error: 'Failed to load organization teams' };
      }

      return { success: true, teams: (data || []) as Team[] };
    },
    [supabase]
  );

  /**
   * Update a member's role
   */
  const updateMemberRole = useCallback(
    async (
      organizationId: string,
      memberId: string,
      role: OrgRole
    ): Promise<{ success: boolean; error?: string }> => {
      const { error, count } = await supabase
        .from('organization_members')
        .update({ role }, { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('id', memberId);

      if (error) {
        console.error('Error updating member role:', error);
        return { success: false, error: 'Failed to update member role.' };
      }

      if (count === 0) {
        return { success: false, error: STALE_ORG_MEMBER_ERROR };
      }

      await refreshOrganizationMemberships();
      return { success: true };
    },
    [supabase, refreshOrganizationMemberships]
  );

  /**
   * Remove a member from an organization
   */
  const removeMember = useCallback(
    async (organizationId: string, memberId: string): Promise<{ success: boolean; error?: string }> => {
      const { error, count } = await supabase
        .from('organization_members')
        .delete({ count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('id', memberId);

      if (error) {
        console.error('Error removing member:', error);
        return { success: false, error: 'Failed to remove member.' };
      }

      if (count === 0) {
        return { success: false, error: STALE_ORG_MEMBER_ERROR };
      }

      await refreshOrganizationMemberships();
      return { success: true };
    },
    [supabase, refreshOrganizationMemberships]
  );

  return {
    createOrganization,
    joinOrganization,
    updateOrganization,
    leaveOrganization,
    getOrganizationMembers,
    getOrganizationTeams,
    updateMemberRole,
    removeMember,
  };
}
