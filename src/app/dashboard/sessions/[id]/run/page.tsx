import { SessionRunMode } from '@/components/sessions/session-run-mode';

interface SessionRunPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SessionRunPage({ params }: SessionRunPageProps) {
  const { id } = await params;
  return <SessionRunMode sessionId={id} />;
}
