import { Suspense } from 'react';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata = {
  title: 'Sign Up - Session Planner',
  description: 'Create your Session Planner account',
};

export default function SignupPage() {
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
      <SignupForm />
    </Suspense>
  );
}
