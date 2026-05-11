'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useTeam } from '@/hooks/use-team';
import { storePendingParentTeamSetupId } from '@/lib/utils/parent-team-setup';
import { normalizeTeamCode, TEAM_CODE_LENGTH } from '@/lib/utils/team-code';
import type { TeamRole } from '@/types/database';

type InviteJoinRole = Extract<TeamRole, 'player' | 'parent'>;
const INVITE_JOIN_ROLES = new Set<string>(['player', 'parent']);

function getRoleFromUrl(value: string | null): InviteJoinRole {
  return INVITE_JOIN_ROLES.has(value || '') ? (value as InviteJoinRole) : 'player';
}

function JoinPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = normalizeTeamCode(searchParams.get('code') || '');
  const roleFromUrl = getRoleFromUrl(searchParams.get('role'));
  const joinRedirectTarget = (() => {
    const params = new URLSearchParams();
    if (codeFromUrl) params.set('code', codeFromUrl);
    if (roleFromUrl !== 'player') params.set('role', roleFromUrl);
    const query = params.toString();
    return query ? `/join?${query}` : '/join';
  })();

  const { user, isLoading: authLoading } = useAuth();
  const { joinTeamByCode } = useTeam();

  const [teamCode, setTeamCode] = useState(codeFromUrl);
  const [role, setRole] = useState<InviteJoinRole>(roleFromUrl);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill code from URL
  useEffect(() => {
    if (codeFromUrl) {
      setTeamCode(codeFromUrl);
    }
  }, [codeFromUrl]);

  useEffect(() => {
    setRole(roleFromUrl);
  }, [roleFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedCode = normalizeTeamCode(teamCode);
    if (normalizedCode.length !== TEAM_CODE_LENGTH) {
      setError('Please enter a valid 6-character team code.');
      return;
    }

    setIsSubmitting(true);

    const result = await joinTeamByCode(normalizedCode, role);

    if (!result.success) {
      setError(result.error || 'Failed to join team');
      setIsSubmitting(false);
      return;
    }

    const parentSetupTeamId = role === 'parent' ? result.team?.id : null;
    if (parentSetupTeamId && user?.id) {
      storePendingParentTeamSetupId(user.id, parentSetupTeamId);
    }

    setSuccess(
      role === 'parent'
        ? `Successfully joined ${result.team?.name}! Redirecting to add your players...`
        : `Successfully joined ${result.team?.name}! Redirecting...`
    );
    setTimeout(() => {
      router.push(
        parentSetupTeamId
          ? `/onboarding?parentTeamId=${encodeURIComponent(parentSetupTeamId)}`
          : '/dashboard'
      );
    }, 1500);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show login prompt
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-navy rounded-xl flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-navy mb-2">Join a Team</h1>
            <p className="text-text-secondary mb-6">
              Sign in or create an account to join your team
            </p>

            {codeFromUrl && (
              <div className="bg-teal-glow rounded-lg p-4 mb-6">
                <p className="text-sm text-teal-dark">Team code ready:</p>
                <p className="text-2xl font-mono font-bold text-navy tracking-widest">{codeFromUrl}</p>
                {roleFromUrl === 'parent' && (
                  <p className="mt-2 text-sm font-semibold text-teal-dark">
                    Parent / Guardian invite
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Link
                href={`/login?redirect=${encodeURIComponent(joinRedirectTarget)}`}
                className="btn-primary w-full py-3 justify-center"
              >
                Sign In
              </Link>
              <Link
                href={`/signup?redirect=${encodeURIComponent(joinRedirectTarget)}`}
                className="btn-secondary w-full py-3 justify-center"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-navy rounded-xl flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-navy text-center mb-2">Join a Team</h1>
          <p className="text-text-secondary text-center mb-6">
            Enter your team&apos;s invite code to join
          </p>

          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm animate-fade-in">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-group">
              <label htmlFor="teamCode" className="label">Team Code</label>
              <input
                id="teamCode"
                type="text"
                value={teamCode}
                onChange={(e) => setTeamCode(normalizeTeamCode(e.target.value))}
                required
                autoCapitalize="characters"
                className="input text-center text-2xl tracking-widest font-mono"
                placeholder="ABC123"
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="role" className="label">Join as</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as InviteJoinRole)}
                className="input"
              >
                <option value="player">Player</option>
                <option value="parent">Parent / Guardian</option>
              </select>
              <p className="text-xs text-text-muted mt-1">
                Coaches should contact the team admin directly
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || teamCode.length !== TEAM_CODE_LENGTH}
              className="btn-primary w-full py-3"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining...
                </span>
              ) : (
                'Join Team'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <Link href="/dashboard" className="text-sm text-teal hover:text-teal-dark">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin" />
            <p className="text-text-secondary">Loading...</p>
          </div>
        </div>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}
