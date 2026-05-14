import { EventDetailClient } from './event-detail-client';

export async function generateStaticParams() {
  return [];
}

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
