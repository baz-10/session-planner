'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTeam } from '@/hooks/use-team';
import { usePlayers } from '@/hooks/use-players';
import type { TeamRole, RelationshipType } from '@/types/database';

type OnboardingStep = 'profile' | 'team-choice' | 'create-team' | 'join-team' | 'add-players' | 'complete';

interface PlayerToAdd {
  firstName: string;
  lastName: string;
}

export function OnboardingFlow() {
  const router = useRouter();
  const { user, profile, updateProfile, refreshTeamMemberships } = useAuth();
  const { createTeam, joinTeamByCode } = useTeam();
  const { createPlayerWithLink } = usePlayers();

  const [step, setStep] = useState<OnboardingStep>('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Profile state
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');

  // Team creation state
  const [teamName, setTeamName] = useState('');
  const [sport, setSport] = useState('basketball');

  // Team join state
  const [teamCode, setTeamCode] = useState('');
  const [joinRole, setJoinRole] = useState<TeamRole>('player');

  // Parent - add players state
  const [playersToAdd, setPlayersToAdd] = useState<PlayerToAdd[]>([{ firstName: '', lastName: '' }]);
  const [relationship, setRelationship] = useState<RelationshipType>('parent');
  const [joinedTeamId, setJoinedTeamId] = useState<string | null>(null);

  const userType = user?.user_metadata?.user_type as string | undefined;
  const isParent = userType === 'parent';
  const isCoach = userType === 'coach';

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const { error } = await updateProfile({
      full_name: fullName,
      phone: phone || null,
    });

    if (error) {
      setError(error.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setStep('team-choice');
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await createTeam({
      name: teamName,
      sport,
    });

    if (!result.success) {
      setError(result.error || 'Failed to create team');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setStep('complete');
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await joinTeamByCode(teamCode, joinRole);

    if (!result.success) {
      setError(result.error || 'Failed to join team');
      setIsSubmitting(false);
      return;
    }

    setJoinedTeamId(result.team?.id || null);
    setIsSubmitting(false);

    // If parent, go to add players step
    if (isParent && result.team) {
      setStep('add-players');
    } else {
      setStep('complete');
    }
  };

  const handleAddPlayers = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!joinedTeamId) {
      setError('No team selected');
      setIsSubmitting(false);
      return;
    }

    // Filter out empty entries
    const validPlayers = playersToAdd.filter(
      (p) => p.firstName.trim() && p.lastName.trim()
    );

    if (validPlayers.length === 0) {
      setError('Please add at least one player');
      setIsSubmitting(false);
      return;
    }

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
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    setStep('complete');
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
    await updateProfile({ onboarding_completed: true });
    await refreshTeamMemberships();
    router.push('/dashboard');
  };

  const renderStep = () => {
    switch (step) {
      case 'profile':
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Complete Your Profile</h2>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
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
                  onClick={() => setStep('create-team')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="font-semibold">Create a New Team</div>
                  <div className="text-sm text-gray-600">
                    Set up a new team and invite players
                  </div>
                </button>
              )}
              <button
                onClick={() => setStep('join-team')}
                className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="font-semibold">Join an Existing Team</div>
                <div className="text-sm text-gray-600">
                  Enter a team code to join
                </div>
              </button>
              <button
                onClick={handleComplete}
                className="w-full p-4 text-gray-500 hover:text-gray-700 text-sm"
              >
                Skip for now
              </button>
            </div>
          </div>
        );

      case 'create-team':
        return (
          <div>
            <button
              onClick={() => setStep('team-choice')}
              className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="text-xl font-semibold mb-4">Create Your Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
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
              onClick={() => setStep('team-choice')}
              className="mb-4 text-sm text-gray-600 hover:text-gray-900 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="text-xl font-semibold mb-4">Join a Team</h2>
            <form onSubmit={handleJoinTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Code
                </label>
                <input
                  type="text"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                  required
                  maxLength={6}
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
                    onChange={(e) => setJoinRole(e.target.value as TeamRole)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="player">Player</option>
                    <option value="coach">Coach</option>
                  </select>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting || teamCode.length !== 6}
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
            <form onSubmit={handleAddPlayers} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your relationship
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as RelationshipType)}
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
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={player.lastName}
                      onChange={(e) => updatePlayer(index, 'lastName', e.target.value)}
                      placeholder="Last name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {playersToAdd.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlayerField(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
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
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-primary hover:text-primary"
                >
                  + Add another player
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
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
              onClick={handleComplete}
              className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-light"
            >
              Go to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}
        {renderStep()}
      </div>
    </div>
  );
}
