import { PlayDetailClient } from './play-detail-client';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export const dynamicParams = true;

interface PlayPageProps {
  params: {
    id: string;
  };
}

export default function PlayPage({ params }: PlayPageProps) {
  return <PlayDetailClient playId={params.id} />;
}
