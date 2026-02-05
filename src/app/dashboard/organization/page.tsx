'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useOrganization } from '@/hooks/use-organization';
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
  };
}

export default function OrganizationSettingsPage() {
  const { currentOrganization, currentOrganizationRole, organizationMemberships } = useAuth();
  const { getOrganizationMembers, getOrganizationTeams, updateMemberRole, removeMember } = useOrganization();

  const [members, setMembers] = useState<OrganizationMemberWithProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [inviteSent, setInviteSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteTimerRef = useRef<NodeJS.Timeout>();

  const isAdmin = currentOrganizationRole === 'admin';

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

      const [membersResult, teamsResult] = await Promise.all([
        getOrganizationMembers(currentOrganization.id),
        getOrganizationTeams(currentOrganization.id),
      ]);

      if (!cancelled) {
        if (membersResult.success && membersResult.members) {
          setMembers(membersResult.members);
        }
        if (teamsResult.success && teamsResult.teams) {
          setTeams(teamsResult.teams);
        }
        setIsLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, getOrganizationMembers, getOrganizationTeams]);

  const sendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;

    const roleText = inviteRole === 'admin' ? 'as an Admin' : 'as a Member';
    const subject = encodeURIComponent(`Join ${currentOrganization.name} on Session Planner`);
    const body = encodeURIComponent(
      `Hi!\n\nYou've been invited to join ${currentOrganization.name} on Session Planner ${roleText}.\n\n` +
        `Please sign up or log in to Session Planner to join the organization.\n\n` +
        `See you soon!`
    );
    window.open(`mailto:${inviteEmail}?subject=${subject}&body=${body}`);
    setInviteSent(true);
    setInviteEmail('');
    inviteTimerRef.current = setTimeout(() => setInviteSent(false), 3000);
  };

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    if (!currentOrganization) return;

    const result = await updateMemberRole(currentOrganization.id, memberId, newRole);
    if (result.success) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } else {
      setError(result.error || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentOrganization) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    const result = await removeMember(currentOrganization.id, memberId);
    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } else {
      setError(result.error || 'Failed to remove member');
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
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Organization Info Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-navy rounded-xl flex items-center justify-center">
            {currentOrganization.logo_url ? (
              <img
                src={currentOrganization.logo_url}
                alt={currentOrganization.name}
                className="w-14 h-14 rounded-lg object-cover"
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
      </div>

      {/* Teams Section */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-navy mb-4 flex items-center gap-2">
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

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No teams in this organization yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center gap-4 p-4 bg-whisper rounded-lg">
                <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {team.name?.charAt(0) || 'T'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy truncate">{team.name}</p>
                  <p className="text-sm text-text-muted capitalize">{team.sport || 'Basketball'}</p>
                </div>
                <span className="badge badge-navy">{team.team_code}</span>
              </div>
            ))}
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

          <form onSubmit={sendEmailInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              required
              aria-label="Email address to invite"
              className="input flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              aria-label="Role for invited person"
              className="input sm:w-32"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn-accent whitespace-nowrap">
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
          {inviteSent && (
            <p className="text-sm text-teal mt-2 animate-fade-in">Email client opened with invite!</p>
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
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No members yet. Invite someone to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-4 p-4 bg-whisper rounded-lg">
                <div className="w-10 h-10 bg-teal-glow rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-teal-dark">
                    {member.profile?.full_name?.charAt(0) || member.profile?.email?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy truncate">
                    {member.profile?.full_name || 'Unknown'}
                  </p>
                  <p className="text-sm text-text-muted truncate">{member.profile?.email}</p>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as OrgRole)}
                      className="input py-1.5 px-2 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="btn-ghost text-error p-2"
                      title="Remove member"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
