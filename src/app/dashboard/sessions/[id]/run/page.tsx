import { SessionRunMode } from '@/components/sessions/session-run-mode';

interface SessionRunPageProps {
  params: {
    id: string;
  };
}

export default function SessionRunPage({ params }: SessionRunPageProps) {
  return <SessionRunMode sessionId={params.id} />;
}
