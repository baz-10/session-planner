import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/supabase-server';
import { DrillLibrary } from '@/components/drills/drill-library';

export const metadata = {
  title: 'Drill Library - Session Planner',
};

export default async function DrillsPage() {
  const user = await getServerUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Drill Library</h1>
        <p className="text-text-secondary">
          Build and organize your collection of training drills
        </p>
      </div>

      <DrillLibrary />
    </div>
  );
}
