import { redirect } from 'next/navigation';
import { getServerUser, getServerProfile } from '@/lib/auth/supabase-server';
import { OnboardingFlow } from '@/components/auth/onboarding-flow';

export const metadata = {
  title: 'Welcome - Session Planner',
  description: 'Complete your Session Planner profile setup',
};

export default async function OnboardingPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getServerProfile();

  // If onboarding is already complete, redirect to dashboard
  if (profile?.onboarding_completed) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary">Welcome to Session Planner</h1>
        <p className="mt-2 text-gray-600">Let&apos;s get you set up</p>
      </div>
      <OnboardingFlow />
    </div>
  );
}
