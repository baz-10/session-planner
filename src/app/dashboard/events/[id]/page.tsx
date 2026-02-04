'use client';

import { useRouter } from 'next/navigation';
import { EventDetail } from '@/components/events';

interface EventPageProps {
  params: {
    id: string;
  };
}

export default function EventPage({ params }: EventPageProps) {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <EventDetail
        eventId={params.id}
        onBack={() => router.push('/dashboard/events')}
      />
    </div>
  );
}
