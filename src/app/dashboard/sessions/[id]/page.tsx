import { SessionDetailClient } from './session-detail-client';

// Required for static export - allows dynamic routes to be generated at runtime
export async function generateStaticParams() {
  // Return at least one placeholder param for static generation
  return [{ id: 'placeholder' }];
}

// Allow additional dynamic params at runtime
export const dynamicParams = true;

interface SessionPageProps {
  params: {
    id: string;
  };
}

export default function SessionPage({ params }: SessionPageProps) {
  return <SessionDetailClient sessionId={params.id} />;
}
