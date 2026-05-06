import { EventDetailClient } from './event-detail-client';

// Required for static export - allows dynamic routes to be generated at runtime
export async function generateStaticParams() {
  // Return at least one placeholder param for static generation
  return [{ id: 'placeholder' }];
}

// Allow additional dynamic params at runtime
export const dynamicParams = true;

interface EventPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const { id } = await params;
  return <EventDetailClient eventId={id} />;
}
