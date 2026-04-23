'use client';

import { useEffect } from 'react';
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
    <div className="min-h-full bg-[#f8fafc] p-3 md:p-4">
      <PlayEditorShell playId={playId} />
    </div>
  );
}
