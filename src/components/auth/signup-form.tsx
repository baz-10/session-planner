'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import type { TeamRole } from '@/types/database';

type UserType = 'coach' | 'player' | 'parent';

const userTypeInfo: Record<UserType, { label: string; description: string; icon: string; role: TeamRole }> = {
  coach: {
    label: "I'm a Coach",
    description: 'Create and manage teams, plan practices, track attendance',
    icon: '🏀',
    role: 'coach',
  },
  player: {
    label: "I'm a Player",
    description: 'Join your team, view schedules, RSVP to events',
    icon: '👟',
    role: 'player',
  },
  parent: {
    label: "I'm a Parent",
    description: 'Manage your children, RSVP on their behalf, stay informed',
    icon: '👨‍👩‍👧‍👦',
    role: 'parent',
  },
};

function sanitizeRedirectTarget(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/')) {
    return fallback;
  }
  return value;
}

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectTarget(searchParams.get('redirect'), '/onboarding');
  const { signUp, signInWithGoogle, signInWithApple, isLoading } = useAuth();

  const [step, setStep] = useState<'type' | 'details'>('type');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTypeSelect = (type: UserType) => {
    setUserType(type);
    setStep('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    const { error, session } = await signUp(email, password, {
      full_name: fullName,
      user_type: userType,
      default_role: userType ? userTypeInfo[userType].role : 'player',
    }, redirectTo);

    if (error) {
      setError(error.message);
      setIsSubmitting(false);
      return;
    }

    if (!session) {
      const message = encodeURIComponent(
        'Account created. Please check your email to confirm your account, then sign in.'
      );
      const nextLoginHref =
        redirectTo === '/onboarding'
          ? `/login?message=${message}`
          : `/login?message=${message}&redirect=${encodeURIComponent(redirectTo)}`;
      router.push(nextLoginHref);
      return;
    }

    router.push(redirectTo);
  };

  const handleSocialSignUp = async (provider: 'google' | 'apple') => {
    if (!userType) {
      setError('Please select your role first');
      return;
    }

    setError('');
    const { error } =
      provider === 'google'
        ? await signInWithGoogle(redirectTo)
        : await signInWithApple(redirectTo);
    if (error) {
      setError(error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  const loginHref =
    redirectTo === '/onboarding'
      ? '/login'
      : `/login?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <div className="min-h-screen flex">
      {/* Left: Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-navy relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute top-1/4 -right-32 w-96 h-96 bg-teal opacity-20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-light opacity-10 rounded-full blur-[80px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-teal rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <span className="text-xl font-bold">Session Planner</span>
            </div>

            <h1 className="text-5xl font-bold leading-tight mb-6">
              Build better<br />
              <span className="text-teal-light">practices.</span>
            </h1>
            <p className="text-lg text-white/70 max-w-md">
              The complete platform for coaches to plan sessions, manage teams, and track progress.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 mt-12">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-teal-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-white/80">Drag-and-drop session builder</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-teal-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-white/80">AI-powered drill suggestions</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-teal-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-white/80">Team chat & notifications</span>
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal to-teal-light" />
      </div>

      {/* Right: Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-navy rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xl font-bold text-navy">Session Planner</span>
          </div>

          {step === 'type' ? (
            <>
              <h2 className="text-3xl font-bold text-navy mb-2">Get started</h2>
              <p className="text-text-secondary mb-8">What best describes you?</p>

              <div className="space-y-3">
                {(Object.entries(userTypeInfo) as [UserType, typeof userTypeInfo.coach][]).map(
                  ([type, info]) => (
                    <button
                      key={type}
                      onClick={() => handleTypeSelect(type)}
                      className="w-full p-5 bg-white border-2 border-border rounded-xl hover:border-teal hover:bg-teal-glow transition-all text-left group"
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-3xl">{info.icon}</span>
                        <div>
                          <div className="font-semibold text-navy group-hover:text-teal-dark">
                            {info.label}
                          </div>
                          <div className="text-sm text-text-secondary mt-1">{info.description}</div>
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>

              <p className="mt-8 text-center text-text-secondary">
                Already have an account?{' '}
                <Link href={loginHref} className="text-teal font-semibold hover:text-teal-dark transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('type')}
                className="mb-6 text-sm text-text-secondary hover:text-navy flex items-center transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <h2 className="text-3xl font-bold text-navy mb-2">Create account</h2>
              <p className="text-text-secondary mb-8 flex items-center gap-2">
                <span className="text-xl">{userType && userTypeInfo[userType].icon}</span>
                {userType && userTypeInfo[userType].label}
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="form-group">
                  <label htmlFor="fullName" className="label">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="input"
                    placeholder="John Doe"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input"
                    placeholder="coach@team.com"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="label">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="input"
                    placeholder="••••••••"
                  />
                  <p className="mt-1.5 text-xs text-text-muted">Minimum 8 characters</p>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="label">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="input"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full py-3"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              <div className="my-8 flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm text-text-muted">or continue with</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleSocialSignUp('google')}
                  className="btn-secondary"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialSignUp('apple')}
                  className="btn-secondary"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Apple
                </button>
              </div>

              <p className="mt-8 text-center text-text-secondary">
                Already have an account?{' '}
                <Link href={loginHref} className="text-teal font-semibold hover:text-teal-dark transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
