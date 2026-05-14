import { redirect } from 'next/navigation';

interface LegacyAuthCallbackPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyAuthCallbackPage({
  searchParams,
}: LegacyAuthCallbackPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      return;
    }

    if (typeof value === 'string') {
      query.set(key, value);
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';
  redirect(`/callback/${suffix}`);
}
