'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { OnboardingFlow } from '@/components/auth/onboarding-flow';
import {
  clearPendingParentTeamSetupId,
  getPendingParentTeamSetupIdFromSearch,
  getStoredPendingParentTeamSetupId,
} from '@/lib/utils/parent-team-setup';

export default function OnboardingPage() {
  const { user, profile, isLoading, teamMemberships } = useAuth();
  const router = useRouter();
  const [pendingParentTeamId, setPendingParentTeamId] = useState<string | null>(null);
  const [checkedPendingParentForUserId, setCheckedPendingParentForUserId] = useState<string | null>(null);
  const pendingParentUserKey = user?.id ?? 'anonymous';
  const hasCheckedPendingParentSetup = checkedPendingParentForUserId === pendingParentUserKey;
  const verifiedParentTeamId =
    pendingParentTeamId &&
    teamMemberships.some(
      (membership) => membership.team.id === pendingParentTeamId && membership.role === 'parent'
    )
      ? pendingParentTeamId
      : null;
  const isParentSetup = Boolean(verifiedParentTeamId);

  useEffect(() => {
    if (!user?.id) {
      setPendingParentTeamId(null);
      setCheckedPendingParentForUserId('anonymous');
      return;
    }

    const pendingTeamId =
      getStoredPendingParentTeamSetupId(user.id) ||
      getPendingParentTeamSetupIdFromSearch(window.location.search);

    setPendingParentTeamId(pendingTeamId);
    setCheckedPendingParentForUserId(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (isLoading || !hasCheckedPendingParentSetup) return;

    if (!isLoading && !user) {
      router.push('/login');
    } else if (!isLoading && profile?.onboarding_completed && !isParentSetup) {
      router.push('/dashboard');
    }
  }, [user, profile, isLoading, router, hasCheckedPendingParentSetup, isParentSetup]);

  if (isLoading || !hasCheckedPendingParentSetup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (profile?.onboarding_completed && !isParentSetup)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary">
          {isParentSetup ? 'Add Your Players' : 'Welcome to Session Planner'}
        </h1>
        <p className="mt-2 text-gray-600">
          {isParentSetup ? 'Connect the players you manage on this team' : "Let's get you set up"}
        </p>
      </div>
      <OnboardingFlow
        initialParentTeamId={verifiedParentTeamId}
        onParentSetupComplete={() => {
          if (user?.id) {
            clearPendingParentTeamSetupId(user.id);
          }
          setPendingParentTeamId(null);
        }}
      />
    </div>
  );
}
