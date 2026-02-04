import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/onboarding';

  if (code) {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user needs onboarding
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        // If onboarding is complete, go to dashboard
        if (profile?.onboarding_completed) {
          return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
        }
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Return to login with error
  return NextResponse.redirect(new URL('/login?error=auth_error', requestUrl.origin));
}
