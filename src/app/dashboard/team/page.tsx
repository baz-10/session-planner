'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTeam } from '@/hooks/use-team';
import Link from 'next/link';

export default function TeamSettingsPage() {
  const { currentTeam, teamMemberships } = useAuth();
  console.log('🟢 TeamSettingsPage render:', { currentTeam: currentTeam?.name, memberships: teamMemberships.length });
  const { getTeamMembers, createTeam, joinTeamByCode } = useTeam();

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'player' | 'parent'>('player');
  const [inviteSent, setInviteSent] = useState(false);

  // Create/Join team state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSport, setNewTeamSport] = useState('basketball');
  const [joinCode, setJoinCode] = useState('');
  const [joinRole, setJoinRole] = useState<'player' | 'coach'>('coach');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current user's role in this team
  const currentMembership = teamMemberships.find(m => m.team.id === currentTeam?.id);
  const isCoachOrAdmin = currentMembership?.role === 'coach' || currentMembership?.role === 'admin';

  // Generate invite link
  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/join?code=${currentTeam?.team_code}`
    : '';

  // Timer refs for cleanup
  const copyTimerRef = useRef<NodeJS.Timeout>();
  const linkTimerRef = useRef<NodeJS.Timeout>();
  const inviteTimerRef = useRef<NodeJS.Timeout>();

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current);
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      if (!currentTeam?.id) return;
      setIsLoading(true);
      const result = await getTeamMembers(currentTeam.id);
      if (!cancelled && result.success && result.members) {
        setMembers(result.members);
      }
      if (!cancelled) setIsLoading(false);
    }
    loadMembers();
    return () => { cancelled = true; };
  }, [currentTeam?.id, getTeamMembers]);

  const copyCode = async () => {
    if (!currentTeam?.team_code) return;
    try {
      await navigator.clipboard.writeText(currentTeam.team_code);
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select and copy not available, just show brief feedback
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1000);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      linkTimerRef.current = setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(true);
      linkTimerRef.current = setTimeout(() => setLinkCopied(false), 1000);
    }
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${currentTeam?.name} on Session Planner`,
          text: `You've been invited to join ${currentTeam?.name}! Use code: ${currentTeam?.team_code}`,
          url: inviteLink,
        });
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const sendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    // Include role suggestion in email
    const roleText = inviteRole === 'player' ? 'as a Player' : inviteRole === 'parent' ? 'as a Parent/Guardian' : '';
    const subject = encodeURIComponent(`Join ${currentTeam?.name} on Session Planner`);
    const body = encodeURIComponent(
      `Hi!\n\nYou've been invited to join ${currentTeam?.name} on Session Planner ${roleText}.\n\n` +
      `Join using this link: ${inviteLink}\n\n` +
      `Or enter this code in the app: ${currentTeam?.team_code}\n\n` +
      `See you on the field!`
    );
    window.open(`mailto:${inviteEmail}?subject=${subject}&body=${body}`);
    setInviteSent(true);
    setInviteEmail('');
    inviteTimerRef.current = setTimeout(() => setInviteSent(false), 3000);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      setFormError('Please enter a team name');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const result = await createTeam({
      name: newTeamName.trim(),
      sport: newTeamSport,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Failed to create team');
      return;
    }

    // Team created successfully - page will re-render with currentTeam
    setShowCreateForm(false);
    setNewTeamName('');
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length !== 6) {
      setFormError('Please enter a valid 6-character team code');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    const result = await joinTeamByCode(joinCode.toUpperCase(), joinRole);

    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Failed to join team');
      return;
    }

    // Joined successfully - page will re-render with currentTeam
    setShowJoinForm(false);
    setJoinCode('');
  };

  if (!currentTeam) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-navy mb-2">Team Setup</h1>
          <p className="text-text-secondary">Create a new team or join an existing one</p>
        </div>

        {formError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {formError}
          </div>
        )}

        {!showCreateForm && !showJoinForm && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Create Team Option */}
            <button
              onClick={() => { setShowCreateForm(true); setFormError(''); }}
              className="card p-6 text-left hover:shadow-md hover:border-teal transition-all"
            >
              <div className="w-12 h-12 bg-teal-glow rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-navy mb-2">Create a New Team</h3>
              <p className="text-text-secondary text-sm">Start fresh with your own team and invite players</p>
            </button>

            {/* Join Team Option */}
            <button
              onClick={() => { setShowJoinForm(true); setFormError(''); }}
              className="card p-6 text-left hover:shadow-md hover:border-teal transition-all"
            >
              <div className="w-12 h-12 bg-navy/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-navy mb-2">Join Existing Team</h3>
              <p className="text-text-secondary text-sm">Enter a team code to join an existing team</p>
            </button>
          </div>
        )}

        {/* Create Team Form */}
        {showCreateForm && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-navy mb-4">Create Your Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
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
                  className="btn-secondary flex-1"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-accent flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join Team Form */}
        {showJoinForm && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-navy mb-4">Join a Team</h3>
            <form onSubmit={handleJoinTeam} className="space-y-4">
              <div className="form-group">
                <label htmlFor="teamCode" className="label">Team Code</label>
                <input
                  id="teamCode"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="input text-center text-2xl tracking-widest font-mono"
                  placeholder="ABC123"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-text-muted mt-1">Ask your coach for the 6-character team code</p>
              </div>
              <div className="form-group">
                <label htmlFor="role" className="label">Join as</label>
                <select
                  id="role"
                  value={joinRole}
                  onChange={(e) => setJoinRole(e.target.value as 'player' | 'coach')}
                  className="input"
                >
                  <option value="coach">Coach</option>
                  <option value="player">Player</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowJoinForm(false)}
                  className="btn-secondary flex-1"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || joinCode.length !== 6}
                  className="btn-accent flex-1"
                >
                  {isSubmitting ? 'Joining...' : 'Join Team'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-navy mb-2">Team Settings</h1>
        <p className="text-text-secondary">Manage your team and invite players</p>
      </div>

      {/* Team Info Card */}
      <div className="card p-6 mb-6">
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
      </div>

      {/* Invite Section - Only for coaches/admins */}
      {isCoachOrAdmin && (
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold text-navy mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Invite Players & Parents
          </h3>

          {/* Team Code Display */}
          <div className="bg-whisper rounded-xl p-6 mb-6">
            <p className="text-sm text-text-secondary mb-2">Team Invite Code</p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <span className="text-3xl md:text-4xl font-mono font-bold text-navy tracking-widest">
                  {currentTeam.team_code}
                </span>
              </div>
              <button
                onClick={copyCode}
                className={`btn ${copied ? 'btn-accent' : 'btn-secondary'} min-w-[100px]`}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-text-muted mt-3">
              Share this code with players and parents to join your team
            </p>
          </div>

          {/* Share Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={shareInvite}
              className="btn-primary py-3 justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Invite
            </button>
            <button
              onClick={copyLink}
              className={`${linkCopied ? 'btn-accent' : 'btn-secondary'} py-3 justify-center`}
            >
              {linkCopied ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Link Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
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
                aria-label="Email address to invite"
                className="input flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'player' | 'parent')}
                aria-label="Role for invited person"
                className="input sm:w-32"
              >
                <option value="player">Player</option>
                <option value="parent">Parent</option>
              </select>
              <button type="submit" className="btn-accent whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send
              </button>
            </form>
            {inviteSent && (
              <p className="text-sm text-teal mt-2 animate-fade-in">
                Email client opened with invite!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-navy mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Team Members ({members.length})
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <p>No members yet. Share your team code to invite players!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 p-4 bg-whisper rounded-lg"
              >
                <div className="w-10 h-10 bg-teal-glow rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-teal-dark">
                    {member.profile?.full_name?.charAt(0) || member.profile?.email?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy truncate">
                    {member.profile?.full_name || 'Unknown'}
                  </p>
                  <p className="text-sm text-text-muted truncate">
                    {member.profile?.email}
                  </p>
                </div>
                <span className={`badge ${
                  member.role === 'admin' ? 'badge-navy' :
                  member.role === 'coach' ? 'badge-teal' :
                  member.role === 'player' ? 'badge-success' :
                  'badge-warning'
                }`}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
