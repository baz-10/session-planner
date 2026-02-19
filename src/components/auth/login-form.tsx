'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';

const PASSWORD_SIGN_IN_TIMEOUT_MS = 60000;
const OAUTH_TIMEOUT_MS = 20000;
const SLOW_REQUEST_HINT_MS = 8000;

function sanitizeRedirectTarget(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/')) {
    return fallback;
  }
  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectTarget(searchParams.get('redirect'), '/dashboard');
  const infoMessage = searchParams.get('message') || '';

  const { signIn, signInWithGoogle, signInWithApple, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [statusHint, setStatusHint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusHint('');

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You appear to be offline. Check your connection and try again.');
      return;
    }

    setIsSubmitting(true);
    const startedAt = Date.now();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let slowHintId: ReturnType<typeof setTimeout> | null = null;

    try {
      // Surface a helpful hint while we wait for potentially cold auth infrastructure.
      slowHintId = setTimeout(() => {
        setStatusHint('Still connecting... this can take up to a minute if services are waking up.');
      }, SLOW_REQUEST_HINT_MS);

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              'Sign-in is taking longer than expected. Please retry, and if it keeps happening check VPN/ad-blocker settings.'
            )
          );
        }, PASSWORD_SIGN_IN_TIMEOUT_MS);
      });

      const signInPromise = signIn(email, password);
      const { error } = await Promise.race([signInPromise, timeoutPromise]);

      if (error) {
        setError(error.message);
        return;
      }

      const elapsedMs = Date.now() - startedAt;
      console.info(`[Login] Password sign-in succeeded in ${elapsedMs}ms`);
      router.push(redirectTo);
    } catch (err: unknown) {
      const elapsedMs = Date.now() - startedAt;
      console.error(`[Login] Password sign-in failed after ${elapsedMs}ms`, err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : err && typeof err === 'object' && 'error' in err
            ? (err as { error: { message: string } }).error.message
            : 'Connection failed. Please try again.';
      setError(errorMessage);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (slowHintId) clearTimeout(slowHintId);
      setStatusHint('');
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setStatusHint('');
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Please try again.')), OAUTH_TIMEOUT_MS)
      );
      const { error } = await Promise.race([signInWithGoogle(redirectTo), timeoutPromise]);
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setStatusHint('');
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Please try again.')), OAUTH_TIMEOUT_MS)
      );
      const { error } = await Promise.race([signInWithApple(redirectTo), timeoutPromise]);
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
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

  const signupHref =
    redirectTo === '/dashboard'
      ? '/signup'
      : `/signup?redirect=${encodeURIComponent(redirectTo)}`;

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
              Plan. Execute.<br />
              <span className="text-teal-light">Win.</span>
            </h1>
            <p className="text-lg text-white/70 max-w-md">
              Join thousands of coaches building better practice sessions with time-tracked activities and real-time collaboration.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-12 mt-12">
            <div>
              <div className="stat-number-lg text-teal-light">10K+</div>
              <div className="text-sm text-white/60 mt-1">Active Coaches</div>
            </div>
            <div>
              <div className="stat-number-lg text-teal-light">50K+</div>
              <div className="text-sm text-white/60 mt-1">Sessions Planned</div>
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal to-teal-light" />
      </div>

      {/* Right: Login Form */}
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

          <h2 className="text-3xl font-bold text-navy mb-2">Welcome back</h2>
          <p className="text-text-secondary mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in">
              {error}
            </div>
          )}
          {!error && infoMessage && (
            <div className="mb-6 p-4 bg-teal-glow border border-teal/30 rounded-lg text-teal-dark text-sm animate-fade-in">
              {infoMessage}
            </div>
          )}
          {!error && statusHint && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm animate-fade-in">
              {statusHint}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label !mb-0">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-teal hover:text-teal-dark transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  Signing in...
                </span>
              ) : (
                'Sign In'
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
              onClick={handleGoogleSignIn}
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
              onClick={handleAppleSignIn}
              className="btn-secondary"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Apple
            </button>
          </div>

          <p className="mt-8 text-center text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href={signupHref} className="text-teal font-semibold hover:text-teal-dark transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
