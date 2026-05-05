'use client';

import Link from 'next/link';
import {
  BarChart3,
  Building2,
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
  const currentMembership = teamMemberships.find((membership) => membership.team.id === currentTeam?.id);
  const roleLabel =
    currentMembership?.role === 'coach'
      ? 'Coach'
      : currentMembership?.role === 'admin'
        ? 'Admin'
        : currentMembership?.role === 'player'
          ? 'Player'
          : 'Parent';

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
        onClick={() => signOut()}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600 shadow-sm transition active:scale-[0.99]"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </MobilePageShell>
  );
}
