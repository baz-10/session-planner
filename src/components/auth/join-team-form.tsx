'use client';

import { useState } from 'react';
import { useTeam } from '@/hooks/use-team';
import type { TeamRole, Team } from '@/types/database';

interface JoinTeamFormProps {
  onSuccess?: (team: Team) => void;
  showRoleSelect?: boolean;
  defaultRole?: TeamRole;
}

export function JoinTeamForm({
  onSuccess,
  showRoleSelect = true,
  defaultRole = 'player',
}: JoinTeamFormProps) {
  const { joinTeamByCode } = useTeam();

  const [teamCode, setTeamCode] = useState('');
  const [role, setRole] = useState<TeamRole>(defaultRole);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    const result = await joinTeamByCode(teamCode, role);

    if (!result.success) {
      setError(result.error || 'Failed to join team');
      setIsSubmitting(false);
      return;
    }

    setSuccess(`Successfully joined ${result.team?.name}!`);
    setTeamCode('');
    setIsSubmitting(false);

    if (result.team && onSuccess) {
      onSuccess(result.team);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          {success}
        </div>
      )}

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
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-center text-xl tracking-widest font-mono"
          placeholder="ABC123"
        />
        <p className="mt-1 text-sm text-gray-500">
          Enter the 6-character code from your coach
        </p>
      </div>

      {showRoleSelect && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Join as
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="player">Player</option>
            <option value="parent">Parent</option>
            <option value="coach">Coach</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || teamCode.length !== 6}
        className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Joining...' : 'Join Team'}
      </button>
    </form>
  );
}
