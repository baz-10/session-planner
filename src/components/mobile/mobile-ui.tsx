'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobilePageShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function MobilePageShell({
  children,
  className,
  contentClassName,
}: MobilePageShellProps) {
  return (
    <div className={cn('min-h-full bg-[#f7f9fc] text-navy', className)}>
      <div
        className={cn(
          'mx-auto flex min-h-full w-full max-w-[480px] flex-col px-4 pb-28 pt-5 md:max-w-none md:px-8 md:pb-8 md:pt-8',
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface MobileHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  subtitle,
  leading,
  trailing,
  className,
}: MobileHeaderProps) {
  return (
    <header className={cn('mb-5 flex items-center gap-3', className)}>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-normal text-navy md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 truncate text-[17px] font-medium leading-6 text-slate-500">
            {subtitle}
          </div>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </header>
  );
}

interface MobileStatCardProps {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  tone?: 'navy' | 'teal' | 'blue' | 'violet' | 'amber';
  className?: string;
}

const statToneClasses: Record<NonNullable<MobileStatCardProps['tone']>, string> = {
  navy: 'bg-primary/10 text-navy',
  teal: 'bg-teal-glow text-teal-dark',
  blue: 'bg-blue-100 text-blue-700',
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-700',
};

export function MobileStatCard({
  icon,
  label,
  value,
  caption,
  tone = 'teal',
  className,
}: MobileStatCardProps) {
  return (
    <article
      className={cn(
        'rounded-[22px] border border-slate-200 bg-white px-3 py-4 text-center shadow-[0_12px_30px_rgba(15,31,51,0.08)]',
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full',
            statToneClasses[tone]
          )}
        >
          {icon}
        </div>
      )}
      <div className="text-[13px] font-bold leading-tight text-slate-600">{label}</div>
      <div className="mt-2 font-mono text-[34px] font-extrabold leading-none tracking-normal text-navy">
        {value}
      </div>
      {caption && <div className="mt-2 text-[13px] font-medium text-slate-500">{caption}</div>}
    </article>
  );
}

interface MobileActionCardProps {
  href?: string;
  icon: ReactNode;
  label: ReactNode;
  caption?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileActionCard({
  href,
  icon,
  label,
  caption,
  onClick,
  className,
}: MobileActionCardProps) {
  const content = (
    <>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal to-teal-dark text-white shadow-[0_10px_24px_rgba(20,184,166,0.24)]">
        {icon}
      </span>
      <span className="mt-3 text-center text-[15px] font-extrabold leading-tight text-navy">
        {label}
      </span>
      {caption && (
        <span className="mt-1 text-center text-xs font-medium leading-4 text-slate-500">
          {caption}
        </span>
      )}
    </>
  );

  const classes = cn(
    'flex min-h-[132px] flex-col items-center justify-center rounded-[20px] border border-slate-200 bg-white px-3 py-4 shadow-[0_12px_28px_rgba(15,31,51,0.08)] transition active:scale-[0.98] md:hover:-translate-y-0.5 md:hover:shadow-lg',
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

interface MobileListCardProps {
  children: ReactNode;
  className?: string;
  as?: 'article' | 'div' | 'section';
}

export function MobileListCard({ children, className, as = 'article' }: MobileListCardProps) {
  const Comp = as;
  return (
    <Comp
      className={cn(
        'rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,31,51,0.07)]',
        className
      )}
    >
      {children}
    </Comp>
  );
}

export interface MobileBottomTabItem {
  name: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
}

interface MobileBottomTabsProps {
  items: MobileBottomTabItem[];
  className?: string;
}

export function MobileBottomTabs({ items, className }: MobileBottomTabsProps) {
  return (
    <nav
      className={cn(
        'safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-10px_30px_rgba(15,31,51,0.08)] backdrop-blur md:hidden',
        className
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[480px] items-center justify-around px-1">
        {items.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'relative flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold text-slate-500 transition-colors',
              item.active && 'text-navy'
            )}
          >
            {item.active && (
              <span className="absolute top-0 h-1 w-11 rounded-b-full bg-navy" />
            )}
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center',
                item.active ? 'text-navy' : 'text-slate-500'
              )}
            >
              {item.icon}
            </span>
            <span className="max-w-full truncate">{item.name}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

interface MobileStickyActionBarProps {
  children: ReactNode;
  className?: string;
}

export function MobileStickyActionBar({ children, className }: MobileStickyActionBarProps) {
  return (
    <div
      className={cn(
        'safe-area-bottom fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-16px_34px_rgba(15,31,51,0.1)] backdrop-blur md:hidden',
        className
      )}
    >
      <div className="mx-auto flex max-w-[480px] items-center gap-3">{children}</div>
    </div>
  );
}

export interface MobileSegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface MobileSegmentedControlProps<T extends string> {
  value: T;
  options: MobileSegmentedControlOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

export function MobileSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  className,
}: MobileSegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-inner',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              'flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-[13px] font-extrabold transition-colors disabled:opacity-50',
              isActive
                ? 'bg-navy text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-navy'
            )}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface MobileEmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function MobileEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: MobileEmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm',
        className
      )}
    >
      {icon && (
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-glow text-teal">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-extrabold text-navy">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface MobileLoadingStateProps {
  label?: ReactNode;
  className?: string;
}

export function MobileLoadingState({ label = 'Loading', className }: MobileLoadingStateProps) {
  return (
    <div className={cn('flex min-h-[50vh] flex-col items-center justify-center', className)}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal border-t-transparent" />
      {label && <p className="mt-3 text-sm font-semibold text-slate-500">{label}</p>}
    </div>
  );
}
