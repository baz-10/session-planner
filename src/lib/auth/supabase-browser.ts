import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const missingEnvErrorMessage = 'Supabase environment variables are not configured';

// Log warning if env vars are missing (helps debug deployment issues)
if (typeof window !== 'undefined') {
  if (!supabaseUrl) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }
  if (!supabaseAnonKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }
}

/**
 * Create a Supabase client for Client Components.
 * Uses Supabase SSR cookie storage so middleware and Server Components can
 * read the same session created by client-side sign-in.
 * Note: Using `any` type to avoid strict type inference issues with Supabase queries.
 */
export function createBrowserSupabaseClient(): any {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === 'undefined') {
      return new Proxy({}, {
        get() {
          throw new Error(missingEnvErrorMessage);
        },
      });
    }

    throw new Error(missingEnvErrorMessage);
  }
  if (process.env.NODE_ENV === 'development') {
    console.log('[Supabase] Creating client for:', supabaseUrl);
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Singleton instance for client-side usage
let browserClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;

/**
 * Get the singleton Supabase client for Client Components.
 * Creates a new client if one doesn't exist.
 */
export function getBrowserSupabaseClient() {
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient();
  }
  return browserClient;
}
