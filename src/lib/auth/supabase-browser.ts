import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for Client Components.
 * This client uses cookies for session management.
 * Note: Using `any` type to avoid strict type inference issues with Supabase queries.
 * In production, consider using `supabase gen types typescript` for proper type safety.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBrowserSupabaseClient(): any {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
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
