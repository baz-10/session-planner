'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import { consumePendingOAuthSignupRole } from '@/lib/utils/oauth-signup-role';
import { sanitizeLocalRedirect } from '@/lib/utils/redirect';

export function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const next = sanitizeLocalRedirect(searchParams.get('next'), '/onboarding');

      if (code) {
        const supabase = getBrowserSupabaseClient();

        const { error: authError } = await supabase.auth.exchangeCodeForSession(code);

        if (!authError) {
          // Check if user needs onboarding
          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            const pendingSignupRole = consumePendingOAuthSignupRole();
            if (pendingSignupRole && !user.user_metadata?.user_type) {
              const { error: metadataError } = await supabase.auth.updateUser({
                data: {
                  ...user.user_metadata,
                  user_type: pendingSignupRole.userType,
                  default_role: pendingSignupRole.defaultRole,
                },
              });

              if (metadataError) {
                console.error('Failed to preserve social sign-up role:', metadataError);
              }
            }

            const { data: profile } = await supabase
              .from('profiles')
              .select('onboarding_completed')
              .eq('id', user.id)
              .single();

            // If onboarding is complete, honor safe invite/deep-link redirects.
            if (profile?.onboarding_completed) {
              router.push(next === '/onboarding' ? '/dashboard' : next);
              return;
            }
          }

          router.push(next);
          return;
        }

        setError('Authentication failed. Please try again.');
      } else {
        // No code, redirect to login
        router.push('/login?error=auth_error');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <a href="/login" className="text-primary hover:underline">
            Return to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
