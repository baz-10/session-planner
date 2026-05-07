'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export default function ForgotPasswordPage() {
  const { resetPassword, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSent(false);
    setIsSubmitting(true);

    const { error } = await resetPassword(email.trim());

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }

    setIsSubmitting(false);
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

        <h1 className="text-3xl font-bold text-navy mb-2">Reset your password</h1>
        <p className="text-text-secondary mb-8">
          Enter your account email and we will send you a secure reset link.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {sent && (
          <div className="mb-6 p-4 bg-teal-glow border border-teal/30 rounded-lg text-teal-dark text-sm animate-fade-in">
            If an account exists for that email, a password reset link has been sent.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="form-group">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="input"
              placeholder="coach@team.com"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3"
          >
            {isSubmitting ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-8 text-center text-text-secondary">
          Remembered your password?{' '}
          <Link href="/login" className="text-teal font-semibold hover:text-teal-dark transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

