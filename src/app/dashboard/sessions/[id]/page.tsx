import { SessionDetailClient } from './session-detail-client';

export async function generateStaticParams() {
  return [];
}

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
