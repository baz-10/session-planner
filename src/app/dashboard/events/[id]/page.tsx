import { EventDetailClient } from './event-detail-client';

// Required for static export - allows dynamic routes to be generated at runtime
export async function generateStaticParams() {
  // Return at least one placeholder param for static generation
  return [{ id: 'placeholder' }];
}

// Allow additional dynamic params at runtime
export const dynamicParams = true;

interface EventPageProps {
  params: {
    id: string;
  };
}

export default function EventPage({ params }: EventPageProps) {
  return <EventDetailClient eventId={params.id} />;
}
