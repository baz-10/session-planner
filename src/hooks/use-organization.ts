'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
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

export function useOrganization() {
  const { user, refreshOrganizationMemberships } = useAuth();
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

      // Add user as admin member
      const { error: memberError } = await supabase.from('organization_members').insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'admin',
      });

      if (memberError) {
        console.error('Error adding admin member:', memberError);
        // Try to clean up the organization
        await supabase.from('organizations').delete().eq('id', org.id);
        return { success: false, error: 'Failed to set up organization membership.' };
      }

      await refreshOrganizationMemberships();

      return { success: true, organization: org as Organization };
    },
    [user, supabase, refreshOrganizationMemberships]
  );

  /**
   * Join an organization by invite (for now, direct join by org ID - can be extended for invite codes)
   */
  const joinOrganization = useCallback(
    async (organizationId: string, role: OrgRole = 'member'): Promise<JoinOrganizationResult> => {
      if (!user) {
        return { success: false, error: 'You must be logged in to join an organization' };
      }

      // Check if organization exists
      const { data: org, error: findError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (findError || !org) {
        return { success: false, error: 'Organization not found.' };
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        return { success: false, error: 'You are already a member of this organization.' };
      }

      // Add user as member
      const { error: joinError } = await supabase.from('organization_members').insert({
        organization_id: organizationId,
        user_id: user.id,
        role,
      });

      if (joinError) {
        console.error('Error joining organization:', joinError);
        return { success: false, error: 'Failed to join organization. Please try again.' };
      }

      await refreshOrganizationMemberships();

      return { success: true, organization: org as Organization };
    },
    [user, supabase, refreshOrganizationMemberships]
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

      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error leaving organization:', error);
        return { success: false, error: 'Failed to leave organization.' };
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
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('organization_id', organizationId)
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
   * Remove a member from an organization
   */
  const removeMember = useCallback(
    async (organizationId: string, memberId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', memberId);

      if (error) {
        console.error('Error removing member:', error);
        return { success: false, error: 'Failed to remove member.' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Invite a member by email (sends email invite)
   */
  const inviteMember = useCallback(
    async (
      organizationId: string,
      email: string,
      role: OrgRole = 'member'
    ): Promise<{ success: boolean; error?: string }> => {
      // For now, this is a placeholder. In a full implementation,
      // you would create an invitation record and send an email.
      // The invited user would then be added when they accept.
      console.log('Invite member:', { organizationId, email, role });
      return { success: true };
    },
    []
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
    inviteMember,
  };
}
