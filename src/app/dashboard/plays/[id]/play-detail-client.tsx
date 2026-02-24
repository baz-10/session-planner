'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { PlayEditorShell } from '@/components/plays/play-editor-shell';

interface PlayDetailClientProps {
  playId: string;
}

export function PlayDetailClient({ playId }: PlayDetailClientProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="p-8 space-y-5">
      <nav className="flex items-center gap-2 text-sm">
        <Link href="/dashboard" className="text-gray-500 hover:text-primary">Dashboard</Link>
        <span className="text-gray-400">/</span>
        <Link href="/dashboard/plays" className="text-gray-500 hover:text-primary">Plays</Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">Edit Play</span>
      </nav>

      <PlayEditorShell playId={playId} />
    </div>
  );
}
