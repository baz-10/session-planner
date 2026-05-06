import { SessionDetailClient } from './session-detail-client';

// Required for static export - allows dynamic routes to be generated at runtime
export async function generateStaticParams() {
  // Return at least one placeholder param for static generation
  return [{ id: 'placeholder' }];
}

// Allow additional dynamic params at runtime
export const dynamicParams = true;

interface SessionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  return <SessionDetailClient sessionId={id} />;
}
