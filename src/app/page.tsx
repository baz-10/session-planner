import Link from 'next/link';
import { getServerUser } from '@/lib/auth/supabase-server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const user = await getServerUser();

  // Redirect authenticated users to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-light">
      <div className="container mx-auto px-4 py-16">
        <nav className="flex justify-between items-center mb-16">
          <div className="text-white text-2xl font-bold">Session Planner</div>
          <div className="space-x-4">
            <Link
              href="/login"
              className="text-white hover:text-accent-light transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-white text-primary rounded-md hover:bg-gray-100 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Sports Team Management Made Simple
          </h1>
          <p className="text-xl text-white/80 mb-12">
            Plan practices, communicate with your team, and track attendance all in one place.
            Built for coaches, players, and parents.
          </p>

          <div className="flex justify-center gap-4 mb-16">
            <Link
              href="/signup"
              className="px-8 py-3 bg-accent text-white rounded-md text-lg font-semibold hover:bg-accent-light transition-colors"
            >
              Start Free
            </Link>
            <Link
              href="#features"
              className="px-8 py-3 border-2 border-white text-white rounded-md text-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Learn More
            </Link>
          </div>

          <div id="features" className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-white">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-semibold mb-2">Practice Planning</h3>
              <p className="text-white/80">
                Build detailed practice sessions with drills, timing, and notes.
                Export as PDF and share with your team.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-white">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">Team Communication</h3>
              <p className="text-white/80">
                Keep everyone informed with posts, direct messages, and team chat.
                No more missed updates.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-white">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-2">Scheduling & RSVPs</h3>
              <p className="text-white/80">
                Create events, collect RSVPs, and track attendance.
                Parents can respond on behalf of their kids.
              </p>
            </div>
          </div>
        </main>

        <footer className="mt-24 text-center text-white/60 text-sm">
          <p>&copy; {new Date().getFullYear()} Session Planner. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
