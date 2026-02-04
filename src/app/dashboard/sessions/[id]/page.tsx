import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/supabase-server';
import { SessionBuilder } from '@/components/sessions/session-builder';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Edit Practice Plan - Session Planner',
};

export default async function EditSessionPage({ params }: PageProps) {
  const user = await getServerUser();

  if (!user) {
    redirect('/login');
  }

  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <a href="/dashboard" className="hover:text-primary">Dashboard</a>
            <span>/</span>
            <a href="/dashboard/sessions" className="hover:text-primary">Sessions</a>
            <span>/</span>
            <span className="text-gray-900">Edit Plan</span>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <SessionBuilder sessionId={id} />
      </main>
    </div>
  );
}
