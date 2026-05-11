import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

function normalizePathname(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * Update session middleware for Supabase Auth.
 * This middleware refreshes the user's session and handles token refresh.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/join',
    '/callback',
    '/auth/callback',
    '/forgot-password',
    '/reset-password',
  ];
  const normalizedPathname = normalizePathname(request.nextUrl.pathname);

  const isPublicRoute = publicRoutes.some(
    (route) =>
      normalizedPathname === route ||
      normalizedPathname.startsWith('/api/auth/')
  );
  // API route handlers return JSON auth errors and handle signed cron requests.
  const isApiRoute = normalizedPathname.startsWith('/api/');
  const isNextAssetRoute = normalizedPathname.startsWith('/_next');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!isPublicRoute && !isApiRoute && !isNextAssetRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const redirectTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      url.searchParams.set('redirect', redirectTarget);
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login for protected routes
  if (!user && !isPublicRoute && !isApiRoute && !isNextAssetRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.searchParams.set('redirect', redirectTarget);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && (normalizedPathname === '/login' || normalizedPathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
