import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerUser } from '@/lib/auth/supabase-server';
import { SessionBuilder } from '@/components/sessions/session-builder';

export const metadata = {
  title: 'New Practice Plan - Session Planner',
};

export default async function NewSessionPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link href="/dashboard" className="text-text-secondary hover:text-teal transition-colors">
          Dashboard
        </Link>
        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href="/dashboard/sessions" className="text-text-secondary hover:text-teal transition-colors">
          Sessions
        </Link>
        <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-navy font-medium">New Plan</span>
      </nav>

      <SessionBuilder isNew />
    </div>
  );
}
