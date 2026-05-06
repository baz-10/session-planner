import { PlayDetailClient } from './play-detail-client';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export const dynamicParams = true;

interface PlayPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { id } = await params;
  return <PlayDetailClient playId={id} />;
}
