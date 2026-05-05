'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useBranding } from '@/hooks/use-branding';
import { CalendarDays, ClipboardCheck, Home, MoreHorizontal, Users } from 'lucide-react';
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
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Sessions',
    href: '/dashboard/sessions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    name: 'Drills',
    href: '/dashboard/drills',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    name: 'Plays',
    href: '/dashboard/plays',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M6 6v12m12-12v12M8 18h8M9 11l2-2m0 0l2 2m-2-2v6"
        />
      </svg>
    ),
  },
  {
    name: 'Events',
    href: '/dashboard/events',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'Attendance',
    href: '/dashboard/attendance',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: 'Billing',
    href: '/dashboard/billing',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 9V7a5 5 0 00-10 0v2M5 9h14l-1 10a2 2 0 01-2 2H8a2 2 0 01-2-2L5 9z"
        />
      </svg>
    ),
  },
  {
    name: 'Feed',
    href: '/dashboard/feed',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
  {
    name: 'Chat',
    href: '/dashboard/chat',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    name: 'Team',
    href: '/dashboard/team',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    name: 'Organization',
    href: '/dashboard/organization',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    requiresOrganization: false, // Show for all users so they can create/join
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, profile, signOut, teamMemberships, currentTeam, organizationMemberships } = useAuth();
  const { displayName, logoUrl } = useBranding();

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
            <div className="w-10 h-10 bg-navy rounded-lg flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt={displayName} className="w-full h-full rounded-lg object-cover" />
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
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
            onClick={() => signOut()}
            className="w-full btn-ghost text-sm justify-start px-3 py-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
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
