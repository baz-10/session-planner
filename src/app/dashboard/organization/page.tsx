'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Copy, Link as LinkIcon, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useOrganization } from '@/hooks/use-organization';
import { useTeam } from '@/hooks/use-team';
import { useConfirmDialog } from '@/components/ui';
import { copyTextToClipboard } from '@/lib/utils/clipboard';
import { openMailtoInvite } from '@/lib/utils/mailto';
import type { Team, OrgRole } from '@/types/database';

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
  } | null;
}

type OrgInviteAction = 'code' | 'link' | 'email';

export default function OrganizationSettingsPage() {
  const {
    currentOrganization,
    currentOrganizationRole,
    organizationMemberships,
    teamMemberships,
    setCurrentTeam,
    user,
  } = useAuth();
  const { getOrganizationMembers, getOrganizationTeams, updateMemberRole, removeMember } = useOrganization();
  const { createTeam } = useTeam();

  const [members, setMembers] = useState<OrganizationMemberWithProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [membersLoadError, setMembersLoadError] = useState('');
  const [teamsLoadError, setTeamsLoadError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const [updatingMemberId, setUpdatingMemberId] = useState('');
  const [inviteAction, setInviteAction] = useState<OrgInviteAction | null>(null);
  const [pageOrigin, setPageOrigin] = useState('');
  const [showCreateTeamForm, setShowCreateTeamForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSport, setNewTeamSport] = useState('basketball');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const { confirmAction, confirmDialog } = useConfirmDialog();

  const inviteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = currentOrganizationRole === 'admin';
  const adminCount = members.filter((member) => member.role === 'admin').length;
  const organizationInviteCode = currentOrganization?.organization_code || '';
  const organizationInviteLink =
    pageOrigin && organizationInviteCode
      ? `${pageOrigin}/dashboard/organization/setup?code=${encodeURIComponent(organizationInviteCode)}`
      : '';
  const inviteActionInFlight = inviteAction !== null;

  useEffect(() => {
    setPageOrigin(window.location.origin);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      if (!currentOrganization?.id) return;
      setIsLoading(true);
      setError(null);
      setMembersLoadError('');
      setTeamsLoadError('');

      try {
        const [membersResult, teamsResult] = await Promise.all([
          getOrganizationMembers(currentOrganization.id),
          getOrganizationTeams(currentOrganization.id),
        ]);

        if (!cancelled) {
          if (membersResult.success && membersResult.members) {
            setMembers(membersResult.members);
          } else {
            setMembers([]);
            setMembersLoadError(membersResult.error || 'Failed to load organization members.');
          }
          if (teamsResult.success && teamsResult.teams) {
            setTeams(teamsResult.teams);
          } else {
            setTeams([]);
            setTeamsLoadError(teamsResult.error || 'Failed to load organization teams.');
          }
        }
      } catch (loadError) {
        console.error('Unexpected error loading organization data:', loadError);
        if (!cancelled) {
          setMembers([]);
          setTeams([]);
          setMembersLoadError('Failed to load organization members.');
          setTeamsLoadError('Failed to load organization teams.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, getOrganizationMembers, getOrganizationTeams]);

  const showInviteFeedback = (message: string) => {
    setInviteFeedback(message);
    if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    inviteTimerRef.current = setTimeout(() => setInviteFeedback(''), 3000);
  };

  const copyOrganizationInviteCode = async () => {
    if (inviteActionInFlight) return;

    if (!organizationInviteCode) {
      setError('Organization invite code is unavailable. Apply the latest database migrations first.');
      return;
    }

    setInviteAction('code');
    try {
      const didCopy = await copyTextToClipboard(organizationInviteCode);
      if (!didCopy) {
        setError('Organization invite code could not be copied. Select the code and copy it manually.');
        return;
      }

      setError(null);
      showInviteFeedback('Organization invite code copied.');
    } finally {
      setInviteAction(null);
    }
  };

  const copyOrganizationInviteLink = async () => {
    if (inviteActionInFlight) return;

    if (!organizationInviteLink) {
      setError('Organization invite link is unavailable. Apply the latest database migrations first.');
      return;
    }

    setInviteAction('link');
    try {
      const didCopy = await copyTextToClipboard(organizationInviteLink);
      if (!didCopy) {
        setError('Organization invite link could not be copied. Try the email invite or copy the code.');
        return;
      }

      setError(null);
      showInviteFeedback('Organization invite link copied.');
    } finally {
      setInviteAction(null);
    }
  };

  const sendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteActionInFlight) return;
    if (!currentOrganization) return;

    if (!organizationInviteCode || !organizationInviteLink) {
      setError('Organization invite link is unavailable. Apply the latest database migrations and refresh.');
      return;
    }

    const subject = `Join ${currentOrganization.name} on Session Planner`;
    const body =
      `Hi!\n\nYou've been invited to join ${currentOrganization.name} on Session Planner.\n\n` +
        `Join using this link: ${organizationInviteLink}\n\n` +
        `Invite code: ${organizationInviteCode}\n\n` +
        `New organization members join as members. An admin can promote trusted users after they join.\n\n` +
        `See you soon!`;

    setInviteAction('email');
    try {
      const didOpen = openMailtoInvite({ to: inviteEmail, subject, body });
      if (!didOpen) {
        setError('Enter an email address before sending an invite.');
        return;
      }

      setError(null);
      showInviteFeedback('Email client opened with a member invite link.');
      setInviteEmail('');
    } finally {
      setInviteAction(null);
    }
  };

  const handleCreateOrganizationTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || isCreatingTeam) return;

    const teamName = newTeamName.trim();
    if (!teamName) {
      setError('Enter a team name before creating an organization team.');
      setActionFeedback('');
      return;
    }

    setIsCreatingTeam(true);
    setError(null);
    setActionFeedback('');

    try {
      const result = await createTeam({
        name: teamName,
        sport: newTeamSport,
        organization_id: currentOrganization.id,
      });

      if (!result.success || !result.team) {
        setError(result.error || 'Failed to create organization team.');
        return;
      }

      const createdTeam = result.team;
      setTeams((prev) =>
        [...prev.filter((team) => team.id !== createdTeam.id), createdTeam].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setNewTeamName('');
      setNewTeamSport('basketball');
      setShowCreateTeamForm(false);
      setActionFeedback('Team created. Open Team Settings to invite players and parents.');
    } catch (createError) {
      console.error('Unexpected error creating organization team:', createError);
      setError('Failed to create organization team.');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const getMemberDisplayName = (member?: OrganizationMemberWithProfile | null) => {
    return member?.profile?.full_name || member?.profile?.email || 'Organization member';
  };

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    if (!currentOrganization || updatingMemberId) return;

    const member = members.find((item) => item.id === memberId);
    if (member?.user_id === user?.id) {
      setError('You cannot change your own organization role.');
      setActionFeedback('');
      return;
    }

    if (member?.role === 'admin' && newRole !== 'admin' && adminCount <= 1) {
      setError('Add another admin before demoting the last organization admin.');
      setActionFeedback('');
      return;
    }

    setUpdatingMemberId(memberId);
    setError(null);
    setActionFeedback('');
    try {
      const result = await updateMemberRole(currentOrganization.id, memberId, newRole);
      if (result.success) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
        setActionFeedback('Organization role updated.');
      } else {
        setError(result.error || 'Failed to update role');
      }
    } catch (updateError) {
      console.error('Unexpected error updating organization role:', updateError);
      setError('Failed to update role.');
    } finally {
      setUpdatingMemberId('');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentOrganization || updatingMemberId) return;
    const member = members.find((item) => item.id === memberId);
    if (member?.user_id === user?.id) {
      setError('You cannot remove your own organization membership from this screen.');
      setActionFeedback('');
      return;
    }

    if (member?.role === 'admin' && adminCount <= 1) {
      setError('Add another admin before removing the last organization admin.');
      setActionFeedback('');
      return;
    }

    const memberName = getMemberDisplayName(member);
    const confirmed = await confirmAction({
      title: 'Remove organization member?',
      description: `${memberName} will lose access to ${currentOrganization.name}.`,
      confirmLabel: 'Remove member',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    setUpdatingMemberId(memberId);
    setError(null);
    setActionFeedback('');
    try {
      const result = await removeMember(currentOrganization.id, memberId);
      if (result.success) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        setActionFeedback('Organization member removed.');
      } else {
        setError(result.error || 'Failed to remove member');
      }
    } catch (removeError) {
      console.error('Unexpected error removing organization member:', removeError);
      setError('Failed to remove member.');
    } finally {
      setUpdatingMemberId('');
    }
  };

  // No organization - show create/join prompt
  if (!currentOrganization && organizationMemberships.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-navy mb-2">No Organization</h3>
          <p className="text-text-secondary mb-6">
            Create or join an organization to manage multiple teams.
          </p>
          <Link href="/dashboard/organization/setup" className="btn-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Create or Join Organization
          </Link>
        </div>
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-center py-8" role="status" aria-label="Loading organization">
          <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-navy mb-2">Organization Settings</h1>
        <p className="text-text-secondary">Manage your organization, teams, and members</p>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss organization error"
            className="float-right text-red-500 hover:text-red-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {actionFeedback && (
        <div role="status" className="bg-teal-glow border border-teal/20 text-teal-dark px-4 py-3 rounded-lg mb-6">
          {actionFeedback}
        </div>
      )}

      {/* Organization Info Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-navy rounded-xl flex items-center justify-center">
            {currentOrganization.logo_url ? (
              <Image
                src={currentOrganization.logo_url}
                alt={currentOrganization.name}
                width={56}
                height={56}
                className="w-14 h-14 rounded-lg object-cover"
                unoptimized
              />
            ) : (
              <span className="text-2xl font-bold text-white">
                {currentOrganization.name?.charAt(0) || 'O'}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy">{currentOrganization.name}</h2>
            <span className={`badge ${isAdmin ? 'badge-teal' : 'badge-navy'}`}>
              {isAdmin ? 'Admin' : 'Member'}
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="mt-4 rounded-lg bg-whisper p-4">
            <p className="text-xs font-semibold uppercase text-text-muted mb-1">Organization Invite Code</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="font-mono text-lg font-bold tracking-wider text-navy">
                {currentOrganization.organization_code || 'Unavailable'}
              </span>
              <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
                <button
                  type="button"
                  onClick={copyOrganizationInviteCode}
                  disabled={!organizationInviteCode || inviteActionInFlight}
                  aria-busy={inviteAction === 'code'}
                  className="btn-secondary min-h-10 justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" />
                  Copy Code
                </button>
                <button
                  type="button"
                  onClick={copyOrganizationInviteLink}
                  disabled={!organizationInviteLink || inviteActionInFlight}
                  aria-busy={inviteAction === 'link'}
                  className="btn-secondary min-h-10 justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LinkIcon className="h-4 w-4" />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Teams Section */}
      <div className="card p-6 mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-navy">
            <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Teams ({teams.length})
          </h3>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setShowCreateTeamForm((value) => !value);
                setError(null);
              }}
              disabled={isCreatingTeam}
              className="btn-primary min-h-10 justify-center"
            >
              <Plus className="h-4 w-4" />
              Create Team
            </button>
          )}
        </div>

        {showCreateTeamForm && (
          <form
            onSubmit={handleCreateOrganizationTeam}
            className="mb-5 rounded-lg border border-border bg-whisper p-4"
            aria-busy={isCreatingTeam}
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div>
                <label htmlFor="organizationTeamName" className="label">
                  Team Name
                </label>
                <input
                  id="organizationTeamName"
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="input"
                  placeholder="e.g., Westside Warriors U14"
                  required
                  disabled={isCreatingTeam}
                />
              </div>
              <div>
                <label htmlFor="organizationTeamSport" className="label">
                  Sport
                </label>
                <select
                  id="organizationTeamSport"
                  value={newTeamSport}
                  onChange={(e) => setNewTeamSport(e.target.value)}
                  className="input"
                  disabled={isCreatingTeam}
                >
                  <option value="basketball">Basketball</option>
                  <option value="soccer">Soccer</option>
                  <option value="football">Football</option>
                  <option value="baseball">Baseball</option>
                  <option value="softball">Softball</option>
                  <option value="volleyball">Volleyball</option>
                  <option value="hockey">Hockey</option>
                  <option value="lacrosse">Lacrosse</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowCreateTeamForm(false);
                  setNewTeamName('');
                  setNewTeamSport('basketball');
                }}
                className="btn-secondary min-h-10 justify-center"
                disabled={isCreatingTeam}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-accent min-h-10 justify-center"
                disabled={isCreatingTeam}
                aria-busy={isCreatingTeam}
              >
                {isCreatingTeam ? 'Creating...' : 'Create Organization Team'}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading organization teams">
            <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          </div>
        ) : teamsLoadError ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {teamsLoadError}
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No teams in this organization yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => {
              const teamMembership = teamMemberships.find((membership) => membership.team.id === team.id);
              const teamInviteCode = teamMembership?.team.team_code || team.team_code;

              return (
                <div key={team.id} className="flex flex-col gap-3 rounded-lg bg-whisper p-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-white">
                        {team.name?.charAt(0) || 'T'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-navy truncate">{team.name}</p>
                      <p className="text-sm text-text-muted capitalize">{team.sport || 'Basketball'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {teamInviteCode && <span className="badge badge-navy justify-center">{teamInviteCode}</span>}
                    {teamMembership && (
                      <Link
                        href="/dashboard/team"
                        onClick={() => setCurrentTeam(teamMembership.team)}
                        className="btn-secondary min-h-10 justify-center"
                      >
                        Manage
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Section - Only for admins */}
      {isAdmin && (
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold text-navy mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Invite Members
          </h3>

          <p className="text-sm text-text-secondary mb-4">
            Invited people join as members. Use the member list below to promote admins after they join.
          </p>

          <form onSubmit={sendEmailInvite} className="flex flex-col sm:flex-row gap-3" aria-busy={inviteAction === 'email'}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              required
              disabled={inviteActionInFlight}
              aria-label="Email address to invite"
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={!organizationInviteCode || !organizationInviteLink || inviteActionInFlight}
              aria-busy={inviteAction === 'email'}
              className="btn-accent whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Send Invite
            </button>
          </form>
          {inviteFeedback && (
            <p role="status" className="text-sm text-teal mt-2 animate-fade-in">{inviteFeedback}</p>
          )}
        </div>
      )}

      {/* Members Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-navy mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Members ({members.length})
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading organization members">
            <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          </div>
        ) : membersLoadError ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {membersLoadError}
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No members yet. Invite someone to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isCurrentUser = member.user_id === user?.id;
              const isLastAdmin = member.role === 'admin' && adminCount <= 1;
              const memberName = getMemberDisplayName(member);
              const isUpdating = updatingMemberId === member.id;
              const controlsDisabled = Boolean(updatingMemberId) || isCurrentUser || isLastAdmin;

              return (
              <div key={member.id} className="flex flex-col gap-3 rounded-lg bg-whisper p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="w-10 h-10 bg-teal-glow rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-teal-dark">
                    {memberName.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy truncate">
                    {memberName}
                    {isCurrentUser && <span className="text-text-muted"> (you)</span>}
                  </p>
                  <p className="text-sm text-text-muted truncate">
                    {member.profile?.email || 'Profile details unavailable'}
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as OrgRole)}
                      disabled={controlsDisabled}
                      aria-busy={isUpdating}
                      aria-label={`Change organization role for ${memberName}`}
                      className="input min-h-10 flex-1 py-1.5 px-2 text-sm sm:w-32 sm:flex-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={controlsDisabled}
                      aria-busy={isUpdating}
                      className="btn-ghost text-error p-2 disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        isUpdating
                          ? 'Saving'
                          : isCurrentUser
                            ? 'You cannot remove yourself from this screen'
                            : isLastAdmin
                              ? 'Add another admin before removing this member'
                              : 'Remove member'
                      }
                      aria-label={`Remove ${memberName} from organization`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <span className={`badge ${member.role === 'admin' ? 'badge-teal' : 'badge-navy'}`}>
                    {member.role}
                  </span>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}
