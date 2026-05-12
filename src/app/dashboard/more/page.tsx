'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  LogOut,
  MessageCircle,
  Newspaper,
  PlaySquare,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useBranding } from '@/hooks/use-branding';
import { MobileHeader, MobileListCard, MobilePageShell } from '@/components/mobile';
import { copyTextToClipboard } from '@/lib/utils/clipboard';

const moreItems = [
  {
    href: '/dashboard/drills',
    label: 'Drill Library',
    description: 'Browse and manage reusable practice activities.',
    icon: <Target className="h-5 w-5" />,
  },
  {
    href: '/dashboard/plays',
    label: 'Playbook',
    description: 'Review diagrams and linked session plays.',
    icon: <PlaySquare className="h-5 w-5" />,
  },
  {
    href: '/dashboard/attendance',
    label: 'Attendance',
    description: 'Track practice and event participation.',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    href: '/dashboard/chat',
    label: 'Team Chat',
    description: 'Message players, parents, and coaches.',
    icon: <MessageCircle className="h-5 w-5" />,
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    description: 'Manage dues, invoices, and payment reminders.',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    href: '/dashboard/feed',
    label: 'Team Feed',
    description: 'Share updates and media with the squad.',
    icon: <Newspaper className="h-5 w-5" />,
  },
  {
    href: '/dashboard/organization',
    label: 'Organization',
    description: 'Club setup, teams, and admin controls.',
    icon: <Building2 className="h-5 w-5" />,
  },
];

export default function MorePage() {
  const { signOut, currentTeam, profile, teamMemberships } = useAuth();
  const { displayName } = useBranding();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [diagnosticsFeedback, setDiagnosticsFeedback] = useState('');
  const currentMembership = teamMemberships.find((membership) => membership.team.id === currentTeam?.id);
  const roleLabel =
    currentMembership?.role === 'coach'
      ? 'Coach'
      : currentMembership?.role === 'admin'
        ? 'Admin'
        : currentMembership?.role === 'player'
          ? 'Player'
          : 'Parent';

  const handleCopyDiagnostics = async () => {
    const viewport =
      typeof window === 'undefined'
        ? 'Unknown'
        : `${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio || 1}x`;
    const route =
      typeof window === 'undefined'
        ? '/dashboard/more'
        : `${window.location.pathname}${window.location.search}`;
    const browser =
      typeof window === 'undefined'
        ? 'Unknown'
        : window.navigator.userAgent;

    const diagnostics = [
      'Session Planner beta diagnostics',
      `Generated: ${new Date().toISOString()}`,
      `Route: ${route}`,
      `Team: ${currentTeam?.name || 'No selected team'}`,
      `Role: ${roleLabel}`,
      `Viewport: ${viewport}`,
      `Browser: ${browser}`,
    ].join('\n');

    const copied = await copyTextToClipboard(diagnostics);
    setDiagnosticsFeedback(
      copied
        ? 'Diagnostics copied. Paste them into your bug report.'
        : 'Could not copy diagnostics. Take a screenshot of this page instead.'
    );
  };

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

  return (
    <MobilePageShell>
      <MobileHeader
        title="More"
        subtitle={currentTeam?.name || displayName}
        trailing={
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-teal shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
        }
      />

      <MobileListCard className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy text-white">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-extrabold text-navy">
            {profile?.full_name || 'Session Planner'}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">{roleLabel}</p>
        </div>
      </MobileListCard>

      <button
        type="button"
        onClick={handleCopyDiagnostics}
        className="mb-5 w-full text-left"
      >
        <MobileListCard className="flex items-center gap-4 transition active:scale-[0.99] md:hover:border-teal">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-extrabold text-navy">Copy Beta Diagnostics</div>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
              Route, team, role, browser, and screen details.
            </p>
            {diagnosticsFeedback && (
              <p role="status" className="mt-2 text-sm font-semibold text-teal-dark">
                {diagnosticsFeedback}
              </p>
            )}
          </div>
          <ClipboardCheck className="h-5 w-5 shrink-0 text-slate-300" />
        </MobileListCard>
      </button>

      <div className="space-y-3">
        {moreItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <MobileListCard className="flex items-center gap-4 transition active:scale-[0.99] md:hover:border-teal">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-glow text-teal">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-navy">{item.label}</div>
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                  {item.description}
                </p>
              </div>
              <span className="text-2xl leading-none text-slate-300">›</span>
            </MobileListCard>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        aria-busy={isSigningOut}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600 shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        {isSigningOut ? 'Signing out...' : 'Sign Out'}
      </button>
      {signOutError && (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-red-600">
          {signOutError}
        </p>
      )}
    </MobilePageShell>
  );
}
