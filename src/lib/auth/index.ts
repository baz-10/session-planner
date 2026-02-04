/**
 * Auth library exports
 */

// Server-side utilities
export {
  createServerSupabaseClient,
  getServerUser,
  getServerSession,
  getServerProfile,
  requireAuth,
} from './supabase-server';

// Client-side utilities
export {
  createBrowserSupabaseClient,
  getBrowserSupabaseClient,
} from './supabase-browser';

// Middleware
export { updateSession } from './supabase-middleware';
