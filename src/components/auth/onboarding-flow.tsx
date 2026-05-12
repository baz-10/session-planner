'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTeam } from '@/hooks/use-team';
import { usePlayers } from '@/hooks/use-players';
import { normalizeTeamCode, TEAM_CODE_LENGTH } from '@/lib/utils/team-code';
import type { TeamRole, RelationshipType } from '@/types/database';

type OnboardingStep = 'profile' | 'team-choice' | 'create-team' | 'join-team' | 'add-players' | 'complete';
type InviteJoinRole = Extract<TeamRole, 'player' | 'parent'>;

interface PlayerToAdd {
  firstName: string;
  lastName: string;
}

interface OnboardingFlowProps {
  initialParentTeamId?: string | null;
  onParentSetupComplete?: () => void;
}

export function OnboardingFlow({
  initialParentTeamId = null,
  onParentSetupComplete,
}: OnboardingFlowProps) {
  const router = useRouter();
  const { user, profile, updateProfile, refreshTeamMemberships, teamMemberships, currentTeam } = useAuth();
  const { createTeam, joinTeamByCode } = useTeam();
  const { createPlayerWithLink } = usePlayers();

  const [step, setStep] = useState<OnboardingStep>(
    initialParentTeamId && profile?.onboarding_completed ? 'add-players' : 'profile'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Profile state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');

  // Team creation state
  const [teamName, setTeamName] = useState('');
  const [sport, setSport] = useState('basketball');
  const userType = user?.user_metadata?.user_type as string | undefined;
  const isParent = userType === 'parent';
  const isCoach = userType === 'coach';

  // Team join state
  const [teamCode, setTeamCode] = useState('');
  const [joinRole, setJoinRole] = useState<InviteJoinRole>(isParent ? 'parent' : 'player');

  // Parent - add players state
  const [playersToAdd, setPlayersToAdd] = useState<PlayerToAdd[]>([{ firstName: '', lastName: '' }]);
  const [relationship, setRelationship] = useState<RelationshipType>('parent');
  const [joinedTeamId, setJoinedTeamId] = useState<string | null>(initialParentTeamId);

  const getJoinedParentTeamId = () => {
    if (initialParentTeamId && teamMemberships.some((membership) => (
      membership.team.id === initialParentTeamId && membership.role === 'parent'
    ))) {
      return initialParentTeamId;
    }

    if (currentTeam?.id && teamMemberships.some((membership) => (
      membership.team.id === currentTeam.id && membership.role === 'parent'
    ))) {
      return currentTeam.id;
    }

    return teamMemberships.find((membership) => membership.role === 'parent')?.team.id || null;
  };

  const hasParentTeamMembership = Boolean(getJoinedParentTeamId());
  const hasTeamMembership = teamMemberships.length > 0;

  useEffect(() => {
    if (!initialParentTeamId) return;

    setJoinedTeamId(initialParentTeamId);
    if (profile?.onboarding_completed) {
      setStep('add-players');
    }
  }, [initialParentTeamId, profile?.onboarding_completed]);

  useEffect(() => {
    if (isParent || hasParentTeamMembership) {
      setJoinRole('parent');
    }
  }, [isParent, hasParentTeamMembership]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      const { error } = await updateProfile({
        full_name: fullName,
        phone: phone || null,
      });

      if (error) {
        setError(error.message);
        return;
      }

      const parentTeamId = getJoinedParentTeamId() || initialParentTeamId;

      if (parentTeamId) {
        setJoinedTeamId(parentTeamId);
        setStep('add-players');
        return;
      }

      if (hasTeamMembership) {
        setStep('complete');
        return;
      }

      setStep('team-choice');
    } catch (error) {
      console.error('Unexpected error saving onboarding profile:', error);
      setError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      const result = await createTeam({
        name: teamName,
        sport,
      });

      if (!result.success) {
        setError(result.error || 'Failed to create team');
        return;
      }

      setStep('complete');
    } catch (error) {
      console.error('Unexpected error creating onboarding team:', error);
      setError(error instanceof Error ? error.message : 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError('');

    const normalizedCode = normalizeTeamCode(teamCode);
    if (normalizedCode.length !== TEAM_CODE_LENGTH) {
      setError('Please enter a valid 6-character team code.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await joinTeamByCode(normalizedCode, joinRole);

      if (!result.success) {
        setError(result.error || 'Failed to join team');
        return;
      }

      setJoinedTeamId(result.team?.id || null);

      // If parent, go to add players step
      if (joinRole === 'parent' && result.team) {
        setStep('add-players');
      } else {
        setStep('complete');
      }
    } catch (error) {
      console.error('Unexpected error joining onboarding team:', error);
      setError(error instanceof Error ? error.message : 'Failed to join team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPlayers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError('');

    if (!joinedTeamId) {
      setError('No team selected');
      return;
    }

    // Filter out empty entries
    const validPlayers = playersToAdd.filter(
      (p) => p.firstName.trim() && p.lastName.trim()
    );

    if (validPlayers.length === 0) {
      setError('Please add at least one player');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create each player
      for (const player of validPlayers) {
        const result = await createPlayerWithLink(
          {
            team_id: joinedTeamId,
            first_name: player.firstName.trim(),
            last_name: player.lastName.trim(),
          },
          relationship
        );

        if (!result.success) {
          setError(result.error || 'Failed to add player');
          return;
        }
      }

      setStep('complete');
    } catch (error) {
      console.error('Unexpected error adding onboarding players:', error);
      setError(error instanceof Error ? error.message : 'Failed to add player');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPlayerField = () => {
    setPlayersToAdd([...playersToAdd, { firstName: '', lastName: '' }]);
  };

  const removePlayerField = (index: number) => {
    if (playersToAdd.length > 1) {
      setPlayersToAdd(playersToAdd.filter((_, i) => i !== index));
    }
  };

  const updatePlayer = (index: number, field: 'firstName' | 'lastName', value: string) => {
    const updated = [...playersToAdd];
    updated[index][field] = value;
    setPlayersToAdd(updated);
  };

  const handleComplete = async () => {
    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      const { error } = await updateProfile({ onboarding_completed: true });
      if (error) {
        setError(error.message || 'Failed to finish onboarding. Please try again.');
        return;
      }

      await refreshTeamMemberships();
      onParentSetupComplete?.();
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to finish onboarding:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Your profile was saved, but teams could not refresh. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'profile':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Complete Your Profile</h2>
            <form onSubmit={handleProfileSubmit} className="space-y-4" aria-busy={isSubmitting}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Continue'}
              </button>
            </form>
          </div>
        );

      case 'team-choice':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Join or Create a Team</h2>
            <div className="space-y-3">
              {isCoach && (
                <button
                  type="button"
                  onClick={() => setStep('create-team')}
                  disabled={isSubmitting}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="font-semibold">Create a New Team</div>
                  <div className="text-sm text-gray-600">
                    Set up a new team and invite players
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep('join-team')}
                disabled={isSubmitting}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="font-semibold">Join an Existing Team</div>
                <div className="text-sm text-gray-600">
                  Enter a team code to join
                </div>
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full p-4 text-gray-500 hover:text-gray-700 text-sm"
              >
                {isSubmitting ? 'Finishing...' : 'Skip for now'}
              </button>
            </div>
          </div>
        );

      case 'create-team':
        return (
          <div>
            <button
              type="button"
              onClick={() => setStep('team-choice')}
              disabled={isSubmitting}
              className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="text-xl font-semibold mb-4">Create Your Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4" aria-busy={isSubmitting}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Tigers U12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sport
                </label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Team'}
              </button>
            </form>
          </div>
        );

      case 'join-team':
        return (
          <div>
            <button
              type="button"
              onClick={() => setStep('team-choice')}
              disabled={isSubmitting}
              className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="text-xl font-semibold mb-4">Join a Team</h2>
            <form onSubmit={handleJoinTeam} className="space-y-4" aria-busy={isSubmitting}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Code
                </label>
                <input
                  type="text"
                  value={teamCode}
                  onChange={(e) => setTeamCode(normalizeTeamCode(e.target.value))}
                  required
                  autoCapitalize="characters"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-center text-2xl tracking-widest font-mono"
                  placeholder="ABC123"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Ask your coach for the 6-character team code
                </p>
              </div>
              {!isParent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Role
                  </label>
                  <select
                    value={joinRole}
                    onChange={(e) => setJoinRole(e.target.value as InviteJoinRole)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="player">Player</option>
                    <option value="parent">Parent / Guardian</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Coaches should join as a player or parent first and ask a team admin to promote them.
                  </p>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting || teamCode.length !== TEAM_CODE_LENGTH}
                aria-busy={isSubmitting}
                className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
              >
                {isSubmitting ? 'Joining...' : 'Join Team'}
              </button>
            </form>
          </div>
        );

      case 'add-players':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-2">Add Your Players</h2>
            <p className="text-gray-600 mb-4">
              Add the players you&apos;ll be managing on this team.
            </p>
            <form onSubmit={handleAddPlayers} className="space-y-4" aria-busy={isSubmitting}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your relationship
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as RelationshipType)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="parent">Parent</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Players
                </label>
                {playersToAdd.map((player, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={player.firstName}
                      onChange={(e) => updatePlayer(index, 'firstName', e.target.value)}
                      placeholder="First name"
                      disabled={isSubmitting}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={player.lastName}
                      onChange={(e) => updatePlayer(index, 'lastName', e.target.value)}
                      placeholder="Last name"
                      disabled={isSubmitting}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {playersToAdd.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlayerField(index)}
                        disabled={isSubmitting}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPlayerField}
                  disabled={isSubmitting}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add another player
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
              >
                {isSubmitting ? 'Adding players...' : 'Continue'}
              </button>
            </form>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">You&apos;re All Set!</h2>
            <p className="text-gray-600 mb-6">
              Your account is ready. Let&apos;s get started.
            </p>
            <button
              type="button"
              onClick={handleComplete}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
            >
              {isSubmitting ? 'Finishing...' : 'Go to Dashboard'}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm"
          >
            {error}
          </div>
        )}
        {renderStep()}
      </div>
    </div>
  );
}
