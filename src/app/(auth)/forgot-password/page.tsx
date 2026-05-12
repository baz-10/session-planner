'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { sanitizeLocalRedirect } from '@/lib/utils/redirect';

function AuthPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin" />
        <p className="text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}

function ForgotPasswordPageContent() {
  const searchParams = useSearchParams();
  const { resetPassword, isLoading } = useAuth();
  const redirectTo = sanitizeLocalRedirect(searchParams.get('redirect'), '');
  const loginHref = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login';
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError('');
    setSent(false);
    setIsSubmitting(true);

    try {
      const { error } = await resetPassword(email.trim(), redirectTo || undefined);

      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } catch (error) {
      console.error('Unexpected error requesting password reset:', error);
      setError(error instanceof Error ? error.message : 'Failed to send reset link');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <AuthPageLoading />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-navy rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-xl font-bold text-navy">Session Planner</span>
        </div>

        <h1 className="text-3xl font-bold text-navy mb-2">Reset your password</h1>
        <p className="text-text-secondary mb-8">
          Enter your account email and we will send you a secure reset link.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in"
          >
            {error}
          </div>
        )}

        {sent && (
          <div
            role="status"
            className="mb-6 p-4 bg-teal-glow border border-teal/30 rounded-lg text-teal-dark text-sm animate-fade-in"
          >
            If an account exists for that email, a password reset link has been sent.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isSubmitting}>
          <div className="form-group">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              disabled={isSubmitting}
              className="input"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="btn-primary w-full py-3"
          >
            {isSubmitting ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-8 text-center text-text-secondary">
          Remembered your password?{' '}
          <Link href={loginHref} className="text-teal font-semibold hover:text-teal-dark transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
