'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword, user, isLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
    const { error } = await updatePassword(password);

    if (error) {
      setError(error.message);
      setIsSubmitting(false);
      return;
    }

    router.push('/login?message=Password%20updated.%20Please%20sign%20in.');
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

        <h1 className="text-3xl font-bold text-navy mb-2">Choose a new password</h1>

        {!user ? (
          <>
            <p className="text-text-secondary mb-8">
              Open this page from the password reset link in your email.
            </p>
            <Link href="/forgot-password" className="btn-primary w-full py-3 inline-flex items-center justify-center">
              Request a new reset link
            </Link>
          </>
        ) : (
          <>
            <p className="text-text-secondary mb-8">
              Create a new password for your account.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="form-group">
                <label htmlFor="password" className="label">New Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input"
                  placeholder="********"
                />
                <p className="mt-1.5 text-xs text-text-muted">Minimum 8 characters</p>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="label">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  className="input"
                  placeholder="********"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-3"
              >
                {isSubmitting ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-text-secondary">
          <Link href="/login" className="text-teal font-semibold hover:text-teal-dark transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

