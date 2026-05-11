'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useBranding } from '@/hooks/use-branding';
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Home,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  PlaySquare,
  Target,
  Users,
} from 'lucide-react';
import { MobileBottomTabs } from '@/components/mobile';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  requiresOrganization?: boolean;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: <Home className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Sessions',
    href: '/dashboard/sessions',
    icon: <ClipboardCheck className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Drills',
    href: '/dashboard/drills',
    icon: <Target className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Plays',
    href: '/dashboard/plays',
    icon: <PlaySquare className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Events',
    href: '/dashboard/events',
    icon: <CalendarDays className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Attendance',
    href: '/dashboard/attendance',
    icon: <BarChart3 className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Billing',
    href: '/dashboard/billing',
    icon: <CreditCard className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Feed',
    href: '/dashboard/feed',
    icon: <Newspaper className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Chat',
    href: '/dashboard/chat',
    icon: <MessageCircle className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Team',
    href: '/dashboard/team',
    icon: <Users className="h-5 w-5" aria-hidden="true" />,
  },
  {
    name: 'Organization',
    href: '/dashboard/organization',
    icon: <Building2 className="h-5 w-5" aria-hidden="true" />,
    requiresOrganization: false, // Show for all users so they can create/join
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut, teamMemberships, currentTeam, organizationMemberships, isLoading } = useAuth();
  const { displayName, logoUrl } = useBranding();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setSignOutError('');
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
      setSignOutError('Could not sign out. Check your connection and try again.');
      setIsSigningOut(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      const redirectTarget =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : pathname;
      router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
    } else if (!isLoading && user && profile && !profile.onboarding_completed) {
      router.replace('/onboarding');
    }
  }, [isLoading, pathname, profile, router, user]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal border-t-transparent" />
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user belongs to an organization
  const hasOrganization = organizationMemberships.length > 0;

  // Get the user's role in the current team
  const currentMembership = teamMemberships.find(m => m.team.id === currentTeam?.id);
  const userRole = currentMembership?.role;

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const moreRoutes = [
    '/dashboard/more',
    '/dashboard/drills',
    '/dashboard/plays',
    '/dashboard/attendance',
    '/dashboard/billing',
    '/dashboard/feed',
    '/dashboard/chat',
    '/dashboard/organization',
  ];

  const bottomNavItems = [
    {
      name: 'Home',
      href: '/dashboard',
      icon: <Home className="h-6 w-6" />,
      active: pathname === '/dashboard',
    },
    {
      name: 'Sessions',
      href: '/dashboard/sessions',
      icon: <ClipboardCheck className="h-6 w-6" />,
      active: pathname.startsWith('/dashboard/sessions'),
    },
    {
      name: 'Events',
      href: '/dashboard/events',
      icon: <CalendarDays className="h-6 w-6" />,
      active: pathname.startsWith('/dashboard/events'),
    },
    {
      name: 'Team',
      href: '/dashboard/team',
      icon: <Users className="h-6 w-6" />,
      active: pathname.startsWith('/dashboard/team'),
    },
    {
      name: 'More',
      href: '/dashboard/more',
      icon: <MoreHorizontal className="h-6 w-6" />,
      active: moreRoutes.some((route) => pathname.startsWith(route)),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <aside className="hidden md:static md:flex md:inset-y-0 md:left-0 md:z-50 md:w-64 md:flex-col md:border-r md:border-border md:bg-white">
        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative w-10 h-10 bg-navy rounded-lg flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={displayName}
                  fill
                  sizes="40px"
                  className="rounded-lg object-cover"
                  unoptimized
                />
              ) : (
                <ClipboardCheck className="h-6 w-6 text-white" aria-hidden="true" />
              )}
            </div>
            <span className="text-lg font-bold text-navy">{displayName}</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            // Organization nav is always visible (so users can create/join)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={isActive(item.href) ? 'nav-item-active' : 'nav-item'}
              >
                {item.icon}
                {item.name}
                {item.name === 'Organization' && hasOrganization && (
                  <span className="ml-auto w-2 h-2 bg-teal rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-teal-glow rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-teal-dark">
                {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-text-muted truncate">
                {userRole === 'coach' ? 'Coach' : userRole === 'admin' ? 'Admin' : userRole === 'player' ? 'Player' : 'Parent'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-busy={isSigningOut}
            className="w-full btn-ghost text-sm justify-start px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </button>
          {signOutError && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-600">
              {signOutError}
            </p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-24 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomTabs items={bottomNavItems} />
    </div>
  );
}
