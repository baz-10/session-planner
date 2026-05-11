'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, Copy, Link as LinkIcon, Mail, Plus, Share2, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useTeam } from '@/hooks/use-team';
import { MobileHeader, MobileListCard, MobilePageShell } from '@/components/mobile';
import { useConfirmDialog } from '@/components/ui';
import { copyTextToClipboard } from '@/lib/utils/clipboard';
import { normalizeTeamCode, TEAM_CODE_LENGTH } from '@/lib/utils/team-code';
import { openMailtoInvite } from '@/lib/utils/mailto';
import type { TeamRole } from '@/types/database';

type InviteJoinRole = Extract<TeamRole, 'player' | 'parent'>;
const MANAGED_TEAM_ROLES: TeamRole[] = ['admin', 'coach', 'player', 'parent'];

type InviteFeedback = {
  type: 'success' | 'error';
  text: string;
};

type InviteAction = 'code' | 'link' | 'share' | 'email';

export default function TeamSettingsPage() {
  const { currentTeam, teamMemberships, user } = useAuth();
  const { getTeamMembers, createTeam, joinTeamByCode, updateMemberRole, removeMember } = useTeam();

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'player' | 'parent'>('player');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<InviteFeedback | null>(null);
  const [membersLoadError, setMembersLoadError] = useState('');
  const [membersReloadKey, setMembersReloadKey] = useState(0);
  const [memberActionError, setMemberActionError] = useState('');
  const [memberActionSuccess, setMemberActionSuccess] = useState('');
  const [updatingMemberId, setUpdatingMemberId] = useState('');
  const [inviteAction, setInviteAction] = useState<InviteAction | null>(null);
  const [pageOrigin, setPageOrigin] = useState('');

  // Create/Join team state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSport, setNewTeamSport] = useState('basketball');
  const [joinCode, setJoinCode] = useState('');
  const [joinRole, setJoinRole] = useState<InviteJoinRole>('player');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { confirmAction, confirmDialog } = useConfirmDialog();

  // Get current user's role in this team
  const currentMembership = teamMemberships.find(m => m.team.id === currentTeam?.id);
  const isCoachOrAdmin = currentMembership?.role === 'coach' || currentMembership?.role === 'admin';
  const canManageMembers = currentMembership?.role === 'admin';
  const adminCount = members.filter((member) => member.role === 'admin').length;
  const hasInviteCode = Boolean(currentTeam?.team_code);
  const inviteActionInFlight = inviteAction !== null;

  const buildInviteLink = (role?: InviteJoinRole) => {
    if (!pageOrigin || !currentTeam?.team_code) return '';

    const url = new URL('/join', pageOrigin);
    url.searchParams.set('code', currentTeam.team_code);
    if (role) {
      url.searchParams.set('role', role);
    }
    return url.toString();
  };

  const inviteLink = buildInviteLink(inviteRole);
  const inviteRoleLabel = inviteRole === 'player' ? 'Player' : 'Parent / Guardian';

  // Timer refs for cleanup
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const linkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inviteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inviteFeedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setPageOrigin(window.location.origin);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current);
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
      if (inviteFeedbackTimerRef.current) clearTimeout(inviteFeedbackTimerRef.current);
    };
  }, []);

  const showInviteFeedback = (feedback: InviteFeedback) => {
    setInviteFeedback(feedback);
    if (inviteFeedbackTimerRef.current) {
      clearTimeout(inviteFeedbackTimerRef.current);
    }
    inviteFeedbackTimerRef.current = setTimeout(() => setInviteFeedback(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      if (!currentTeam?.id) return;
      setIsLoading(true);
      setMembersLoadError('');
      try {
        const result = await getTeamMembers(currentTeam.id);
        if (!cancelled && result.success && result.members) {
          setMembers(result.members);
        } else if (!cancelled) {
          setMembers([]);
          setMembersLoadError(result.error || 'Failed to load team members.');
        }
      } catch (error) {
        console.error('Unexpected error loading team members:', error);
        if (!cancelled) {
          setMembers([]);
          setMembersLoadError('Failed to load team members.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadMembers();
    return () => { cancelled = true; };
  }, [currentTeam?.id, getTeamMembers, membersReloadKey]);

  const copyCode = async () => {
    if (inviteActionInFlight) return;

    if (!currentTeam?.team_code) {
      showInviteFeedback({
        type: 'error',
        text: 'Team invite code is unavailable. Apply the latest database migrations and refresh.',
      });
      return;
    }

    setInviteAction('code');
    try {
      const didCopy = await copyTextToClipboard(currentTeam.team_code);
      if (didCopy) {
        setCopied(true);
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
        return;
      }

      showInviteFeedback({
        type: 'error',
        text: 'Team code could not be copied. Select the code and copy it manually.',
      });
    } finally {
      setInviteAction(null);
    }
  };

  const copyLink = async () => {
    if (inviteActionInFlight) return false;

    if (!inviteLink) {
      showInviteFeedback({
        type: 'error',
        text: 'Team invite link is unavailable. Apply the latest database migrations and refresh.',
      });
      return false;
    }

    setInviteAction('link');
    try {
      const didCopy = await copyTextToClipboard(inviteLink);
      if (didCopy) {
        setLinkCopied(true);
        linkTimerRef.current = setTimeout(() => setLinkCopied(false), 2000);
        return true;
      }

      showInviteFeedback({
        type: 'error',
        text: 'Invite link could not be copied. Try the email invite or copy the team code.',
      });
      return false;
    } finally {
      setInviteAction(null);
    }
  };

  const shareInvite = async () => {
    if (inviteActionInFlight) return;

    if (!currentTeam?.team_code || !inviteLink) {
      showInviteFeedback({
        type: 'error',
        text: 'Team invite is unavailable. Apply the latest database migrations and refresh.',
      });
      return;
    }

    setInviteAction('share');
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Join ${currentTeam?.name} on Session Planner`,
            text: `You've been invited to join ${currentTeam?.name} as a ${inviteRoleLabel}. Use code: ${currentTeam?.team_code}`,
            url: inviteLink,
          });
          showInviteFeedback({ type: 'success', text: 'Invite shared.' });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          await copyLink();
        }
      } else {
        await copyLink();
      }
    } finally {
      setInviteAction(null);
    }
  };

  const sendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteActionInFlight) return;
    if (!currentTeam) return;
    if (!currentTeam.team_code || !inviteLink) {
      showInviteFeedback({
        type: 'error',
        text: 'Team invite link is unavailable. Apply the latest database migrations and refresh.',
      });
      return;
    }

    // Include role suggestion in email
    const roleText = inviteRole === 'player' ? 'as a Player' : 'as a Parent/Guardian';
    const subject = `Join ${currentTeam.name} on Session Planner`;
    const body =
      `Hi!\n\nYou've been invited to join ${currentTeam.name} on Session Planner ${roleText}.\n\n` +
      `Join using this link: ${inviteLink}\n\n` +
      `Or enter this code in the app: ${currentTeam.team_code}\n\n` +
      `See you on the field!`;

    setInviteAction('email');
    try {
      const didOpen = openMailtoInvite({ to: inviteEmail, subject, body });
      if (!didOpen) {
        showInviteFeedback({ type: 'error', text: 'Enter an email address before sending an invite.' });
        return;
      }

      setInviteSent(true);
      setInviteEmail('');
      inviteTimerRef.current = setTimeout(() => setInviteSent(false), 3000);
    } finally {
      setInviteAction(null);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newTeamName.trim()) {
      setFormError('Please enter a team name');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const result = await createTeam({
        name: newTeamName.trim(),
        sport: newTeamSport,
      });

      if (!result.success) {
        setFormError(result.error || 'Failed to create team');
        return;
      }

      // Team created successfully - page will re-render with currentTeam
      setShowCreateForm(false);
      setNewTeamName('');
    } catch (error) {
      console.error('Unexpected error creating team:', error);
      setFormError('Failed to create team. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const normalizedCode = normalizeTeamCode(joinCode);
    if (normalizedCode.length !== TEAM_CODE_LENGTH) {
      setFormError('Please enter a valid 6-character team code');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const result = await joinTeamByCode(normalizedCode, joinRole);

      if (!result.success) {
        setFormError(result.error || 'Failed to join team');
        return;
      }

      // Joined successfully - page will re-render with currentTeam
      setShowJoinForm(false);
      setJoinCode('');
    } catch (error) {
      console.error('Unexpected error joining team:', error);
      setFormError('Failed to join team. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMemberRoleChange = async (member: any, role: TeamRole) => {
    if (!currentTeam?.id || !canManageMembers) return;

    if (member.user_id === user?.id) {
      setMemberActionError('You cannot change your own team role.');
      setMemberActionSuccess('');
      return;
    }

    if (member.role === 'admin' && role !== 'admin' && adminCount <= 1) {
      setMemberActionError('Add another admin before changing the last admin role.');
      setMemberActionSuccess('');
      return;
    }

    setUpdatingMemberId(member.id);
    setMemberActionError('');
    setMemberActionSuccess('');

    try {
      const result = await updateMemberRole(currentTeam.id, member.id, role);

      if (!result.success) {
        setMemberActionError(result.error || 'Failed to update member role.');
        return;
      }

      setMembers((prev) =>
        prev.map((item) => (item.id === member.id ? { ...item, role } : item))
      );
      setMemberActionSuccess('Member role updated.');
    } catch (error) {
      console.error('Unexpected error updating team member role:', error);
      setMemberActionError('Failed to update member role.');
    } finally {
      setUpdatingMemberId('');
    }
  };

  const handleRemoveMember = async (member: any) => {
    if (!currentTeam?.id || !canManageMembers) return;

    if (member.user_id === user?.id) {
      setMemberActionError('Use Leave Team to remove yourself from a team.');
      setMemberActionSuccess('');
      return;
    }

    if (member.role === 'admin' && adminCount <= 1) {
      setMemberActionError('Add another admin before removing the last admin.');
      setMemberActionSuccess('');
      return;
    }

    const memberName = member.profile?.full_name || member.profile?.email || 'this member';
    const confirmed = await confirmAction({
      title: 'Remove team member?',
      description: `${memberName} will lose access to ${currentTeam.name}.`,
      confirmLabel: 'Remove member',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    setUpdatingMemberId(member.id);
    setMemberActionError('');
    setMemberActionSuccess('');

    try {
      const result = await removeMember(currentTeam.id, member.id);

      if (!result.success) {
        setMemberActionError(result.error || 'Failed to remove member.');
        return;
      }

      setMembers((prev) => prev.filter((item) => item.id !== member.id));
      setMemberActionSuccess('Member removed from team.');
    } catch (error) {
      console.error('Unexpected error removing team member:', error);
      setMemberActionError('Failed to remove member.');
    } finally {
      setUpdatingMemberId('');
    }
  };

  if (!currentTeam) {
    return (
      <MobilePageShell contentClassName="md:max-w-2xl">
        <MobileHeader
          title="Team Setup"
          subtitle="Create a new team or join an existing one"
        />

        {formError && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            {formError}
          </div>
        )}

        {!showCreateForm && !showJoinForm && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Create Team Option */}
            <button
              type="button"
              onClick={() => { setShowCreateForm(true); setFormError(''); }}
              className="min-h-[150px] rounded-[22px] border border-slate-200 bg-white p-5 text-left shadow-[0_12px_30px_rgba(15,31,51,0.08)] transition-all active:scale-[0.98] md:hover:border-teal md:hover:shadow-md"
            >
              <div className="w-12 h-12 bg-teal-glow rounded-xl flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-teal" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-navy mb-2">Create a New Team</h3>
              <p className="text-text-secondary text-sm">Start fresh with your own team and invite players</p>
            </button>

            {/* Join Team Option */}
            <button
              type="button"
              onClick={() => { setShowJoinForm(true); setFormError(''); }}
              className="min-h-[150px] rounded-[22px] border border-slate-200 bg-white p-5 text-left shadow-[0_12px_30px_rgba(15,31,51,0.08)] transition-all active:scale-[0.98] md:hover:border-teal md:hover:shadow-md"
            >
              <div className="w-12 h-12 bg-navy/10 rounded-xl flex items-center justify-center mb-4">
                <UserPlus className="h-6 w-6 text-navy" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-navy mb-2">Join Existing Team</h3>
              <p className="text-text-secondary text-sm">Enter a team code to join an existing team</p>
            </button>
          </div>
        )}

        {/* Create Team Form */}
        {showCreateForm && (
          <MobileListCard>
            <h3 className="text-lg font-semibold text-navy mb-4">Create Your Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4" aria-busy={isSubmitting}>
              <div className="form-group">
                <label htmlFor="teamName" className="label">Team Name</label>
                <input
                  id="teamName"
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="input"
                  placeholder="e.g., Westside Warriors U14"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="sport" className="label">Sport</label>
                <select
                  id="sport"
                  value={newTeamSport}
                  onChange={(e) => setNewTeamSport(e.target.value)}
                  className="input"
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
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary min-h-12 flex-1"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="btn-accent min-h-12 flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </MobileListCard>
        )}

        {/* Join Team Form */}
        {showJoinForm && (
          <MobileListCard>
            <h3 className="text-lg font-semibold text-navy mb-4">Join a Team</h3>
            <form onSubmit={handleJoinTeam} className="space-y-4" aria-busy={isSubmitting}>
              <div className="form-group">
                <label htmlFor="teamCode" className="label">Team Code</label>
                <input
                  id="teamCode"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(normalizeTeamCode(e.target.value))}
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="ABC123"
                  autoCapitalize="characters"
                  required
                />
                <p className="text-xs text-text-muted mt-1">Ask your coach for the 6-character team code</p>
              </div>
              <div className="form-group">
                <label htmlFor="role" className="label">Join as</label>
                <select
                  id="role"
                  value={joinRole}
                  onChange={(e) => setJoinRole(e.target.value as InviteJoinRole)}
                  className="input"
                >
                  <option value="player">Player</option>
                  <option value="parent">Parent / Guardian</option>
                </select>
                <p className="text-xs text-text-muted mt-1">
                  Coaches should join first and ask a team admin to promote them.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowJoinForm(false)}
                  className="btn-secondary min-h-12 flex-1"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || joinCode.length !== TEAM_CODE_LENGTH}
                  aria-busy={isSubmitting}
                  className="btn-accent min-h-12 flex-1"
                >
                  {isSubmitting ? 'Joining...' : 'Join Team'}
                </button>
              </div>
            </form>
          </MobileListCard>
        )}
      </MobilePageShell>
    );
  }

  return (
    <MobilePageShell contentClassName="md:max-w-4xl">
      <MobileHeader
        title="Team Settings"
        subtitle="Manage your team and invite players"
      />

      {/* Team Info Card */}
      <MobileListCard className="mb-5">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-navy rounded-xl flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {currentTeam.name?.charAt(0) || 'T'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy">{currentTeam.name}</h2>
            <p className="text-text-secondary capitalize">{currentTeam.sport || 'Basketball'}</p>
          </div>
        </div>
      </MobileListCard>

      {/* Invite Section - Only for coaches/admins */}
      {isCoachOrAdmin && (
        <MobileListCard className="mb-5">
          <h3 className="text-lg font-semibold text-navy mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-teal" aria-hidden="true" />
            Invite Players & Parents
          </h3>

          {inviteFeedback && (
            <div
              role={inviteFeedback.type === 'error' ? 'alert' : 'status'}
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                inviteFeedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {inviteFeedback.text}
            </div>
          )}

          {/* Team Code Display */}
          <div className="mb-6 rounded-[20px] bg-whisper p-5">
            <p className="text-sm text-text-secondary mb-2">Team Invite Code</p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <span className="break-all font-mono text-3xl font-bold tracking-widest text-navy md:text-4xl">
                  {currentTeam.team_code || 'Unavailable'}
                </span>
              </div>
              <button
                type="button"
                onClick={copyCode}
                disabled={!hasInviteCode || inviteActionInFlight}
                aria-busy={inviteAction === 'code'}
                className={`btn min-h-12 justify-center ${copied ? 'btn-accent' : 'btn-secondary'} sm:min-w-[112px]`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-text-muted mt-3">
              Share this code with players and parents to join your team
            </p>
          </div>

          <div className="mb-4 rounded-[18px] border border-border bg-white p-4">
            <label htmlFor="inviteRole" className="mb-2 block text-sm font-semibold text-navy">
              Invite role
            </label>
            <select
              id="inviteRole"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'player' | 'parent')}
              disabled={inviteActionInFlight}
              className="input"
            >
              <option value="player">Player</option>
              <option value="parent">Parent / Guardian</option>
            </select>
          </div>

          {/* Share Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              onClick={shareInvite}
              disabled={!hasInviteCode || !inviteLink || inviteActionInFlight}
              aria-busy={inviteAction === 'share'}
              className="btn-primary min-h-12 justify-center py-3"
            >
              <Share2 className="h-5 w-5" aria-hidden="true" />
              Share Invite
            </button>
            <button
              type="button"
              onClick={copyLink}
              disabled={!inviteLink || inviteActionInFlight}
              aria-busy={inviteAction === 'link'}
              className={`${linkCopied ? 'btn-accent' : 'btn-secondary'} min-h-12 justify-center py-3`}
            >
              {linkCopied ? (
                <>
                  <Check className="h-5 w-5" aria-hidden="true" />
                  Link Copied!
                </>
              ) : (
                <>
                  <LinkIcon className="h-5 w-5" aria-hidden="true" />
                  Copy Invite Link
                </>
              )}
            </button>
          </div>

          {/* Email Invite */}
          <div className="border-t border-border pt-6">
            <h4 className="text-sm font-semibold text-navy mb-3">Send Email Invite</h4>
            <form onSubmit={sendEmailInvite} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="player@email.com"
                required
                disabled={inviteActionInFlight}
                aria-label="Email address to invite"
                className="input flex-1"
              />
              <button
                type="submit"
                disabled={!hasInviteCode || !inviteLink || inviteActionInFlight}
                aria-busy={inviteAction === 'email'}
                className="btn-accent whitespace-nowrap"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Send
              </button>
            </form>
            {inviteSent && (
              <p role="status" className="text-sm text-teal mt-2 animate-fade-in">
                Email client opened with invite!
              </p>
            )}
          </div>
        </MobileListCard>
      )}

      {/* Team Members */}
      <MobileListCard>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-navy">
            <Users className="h-5 w-5 text-teal" aria-hidden="true" />
            Team Members ({members.length})
          </h3>
          {canManageMembers ? (
            <p className="text-sm font-medium text-text-muted">
              Promote coaches and manage access here.
            </p>
          ) : (
            <p className="text-sm font-medium text-text-muted">
              Admin role required to change member access.
            </p>
          )}
        </div>

        {memberActionError && (
          <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {memberActionError}
          </div>
        )}
        {memberActionSuccess && (
          <div role="status" className="mb-4 rounded-2xl border border-teal/20 bg-teal-glow px-4 py-3 text-sm font-medium text-teal-dark">
            {memberActionSuccess}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading team members">
            <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          </div>
        ) : membersLoadError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            <p>{membersLoadError}</p>
            <button
              type="button"
              onClick={() => setMembersReloadKey((value) => value + 1)}
              className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No members yet. Share your team code to invite players!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isCurrentUser = member.user_id === user?.id;
              const isLastAdmin = member.role === 'admin' && adminCount <= 1;
              const isUpdating = updatingMemberId === member.id;
              const controlsDisabled = Boolean(updatingMemberId) || isCurrentUser || isLastAdmin;

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 rounded-2xl bg-whisper p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="w-10 h-10 bg-teal-glow rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-teal-dark">
                        {member.profile?.full_name?.charAt(0) || member.profile?.email?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-navy truncate">
                        {member.profile?.full_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-text-muted truncate">
                        {member.profile?.email}
                      </p>
                      {(isCurrentUser || isLastAdmin) && (
                        <p className="mt-1 text-xs font-semibold text-text-muted">
                          {isCurrentUser ? 'You' : 'Last admin'}
                        </p>
                      )}
                    </div>
                  </div>

                  {canManageMembers ? (
                    <div className="flex items-center gap-2 sm:justify-end">
                      <select
                        value={member.role}
                        onChange={(event) => handleMemberRoleChange(member, event.target.value as TeamRole)}
                        disabled={controlsDisabled}
                        aria-busy={isUpdating}
                        aria-label={`Role for ${member.profile?.full_name || member.profile?.email || 'member'}`}
                        className="input min-h-11 flex-1 capitalize sm:w-32 sm:flex-none"
                      >
                        {MANAGED_TEAM_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member)}
                        disabled={controlsDisabled}
                        aria-busy={isUpdating}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-red-100 bg-white px-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isUpdating ? 'Saving' : 'Remove'}
                      </button>
                    </div>
                  ) : (
                    <span className={`badge ${
                      member.role === 'admin' ? 'badge-navy' :
                      member.role === 'coach' ? 'badge-teal' :
                      member.role === 'player' ? 'badge-success' :
                      'badge-warning'
                    }`}>
                      {member.role}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </MobileListCard>
      {confirmDialog}
    </MobilePageShell>
  );
}
