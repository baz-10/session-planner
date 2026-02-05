'use client';

import { useRouter } from 'next/navigation';
import { EventDetail } from '@/components/events';

interface EventDetailClientProps {
  eventId: string;
}

export function EventDetailClient({ eventId }: EventDetailClientProps) {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <EventDetail
        eventId={eventId}
        onBack={() => router.push('/dashboard/events')}
      />
    </div>
  );
}
