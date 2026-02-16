'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';

export default function DashboardPage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    } else if (!isLoading && user && profile && !profile.onboarding_completed) {
      router.push('/onboarding');
    }
  }, [user, profile, isLoading, router]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Coach'}
        </h1>
        <p className="text-text-secondary">
          Here&apos;s what&apos;s happening with your team today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card p-6">
          <div className="section-label">Upcoming</div>
          <div className="stat-number text-navy">3</div>
          <p className="text-sm text-text-secondary mt-1">Sessions this week</p>
        </div>
        <div className="card p-6">
          <div className="section-label">Team Size</div>
          <div className="stat-number text-navy">18</div>
          <p className="text-sm text-text-secondary mt-1">Active players</p>
        </div>
        <div className="card p-6">
          <div className="section-label">Drill Library</div>
          <div className="stat-number text-navy">24</div>
          <p className="text-sm text-text-secondary mt-1">Saved drills</p>
        </div>
        <div className="card p-6">
          <div className="section-label">Attendance</div>
          <div className="stat-number text-teal">87%</div>
          <p className="text-sm text-text-secondary mt-1">This month</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-navy mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/dashboard/sessions/new" className="card card-hover p-6 group">
            <div className="w-12 h-12 bg-teal-glow rounded-lg flex items-center justify-center mb-4 group-hover:bg-teal group-hover:text-white transition-colors">
              <svg className="w-6 h-6 text-teal group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy mb-1">New Session</h3>
            <p className="text-sm text-text-secondary">Create a practice plan with timed activities</p>
          </Link>

          <Link href="/dashboard/events" className="card card-hover p-6 group">
            <div className="w-12 h-12 bg-navy/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-navy transition-colors">
              <svg className="w-6 h-6 text-navy group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy mb-1">Schedule Event</h3>
            <p className="text-sm text-text-secondary">Add a game, practice, or team event</p>
          </Link>

          <Link href="/dashboard/chat" className="card card-hover p-6 group">
            <div className="w-12 h-12 bg-navy/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-navy transition-colors">
              <svg className="w-6 h-6 text-navy group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy mb-1">Team Chat</h3>
            <p className="text-sm text-text-secondary">Message players and parents</p>
          </Link>

          <Link href="/dashboard/billing" className="card card-hover p-6 group">
            <div className="w-12 h-12 bg-navy/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-navy transition-colors">
              <svg className="w-6 h-6 text-navy group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h5M6 5h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-navy mb-1">Billing</h3>
            <p className="text-sm text-text-secondary">Create invoices and collect team dues</p>
          </Link>
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-navy">Recent Sessions</h2>
          <Link href="/dashboard/sessions" className="text-sm text-teal hover:text-teal-dark font-medium">
            View all
          </Link>
        </div>
        <div className="card overflow-hidden">
          <div className="p-6 text-center">
            <div className="empty-state-icon mx-auto">
              <svg className="w-16 h-16 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-medium text-navy mt-4 mb-2">No sessions yet</h3>
            <p className="text-sm text-text-secondary mb-4">Create your first practice plan to get started</p>
            <Link href="/dashboard/sessions/new" className="btn-accent">
              Create Session
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
