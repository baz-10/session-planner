import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerUser } from '@/lib/auth/supabase-server';
import { SessionsList } from '@/components/sessions/sessions-list';

export const metadata = {
  title: 'Sessions - Session Planner',
};

export default async function SessionsPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2">Practice Plans</h1>
          <p className="text-text-secondary">
            Create and manage your training sessions
          </p>
        </div>
        <Link href="/dashboard/sessions/new" className="btn-accent">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Session
        </Link>
      </div>

      <SessionsList />
    </div>
  );
}
