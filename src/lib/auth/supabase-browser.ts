import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
 * Uses localStorage for session persistence (works with static exports).
 * Note: Using `any` type to avoid strict type inference issues with Supabase queries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBrowserSupabaseClient(): any {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured');
  }
  console.log('[Supabase] Creating client for:', supabaseUrl);
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storageKey: 'session-planner-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
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
