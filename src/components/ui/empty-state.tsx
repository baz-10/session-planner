import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-gray-300">
          {React.isValidElement(icon) ? (
            React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
              className: cn('w-16 h-16', (icon as React.ReactElement<{ className?: string }>).props?.className),
            })
          ) : (
            <div className="w-16 h-16 flex items-center justify-center text-6xl">{icon}</div>
          )}
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>

      {description && <p className="text-sm text-gray-500 max-w-sm mb-6">{description}</p>}

      {action && (
        <Button onClick={action.onClick} variant="default">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-built empty states for common scenarios
export function NoDataEmptyState({
  title = 'No data yet',
  description = "You haven't created anything yet. Get started by creating your first item.",
  action,
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-16 h-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      }
      title={title}
      description={description}
      action={action}
    />
  );
}

export function SearchEmptyState({
  title = 'No results found',
  description = "We couldn't find anything matching your search. Try different keywords or clear filters.",
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-16 h-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
      title={title}
      description={description}
    />
  );
}

export function ErrorEmptyState({
  title = 'Something went wrong',
  description = 'An error occurred while loading the data. Please try again.',
  action,
}: Partial<EmptyStateProps>) {
  return (
    <EmptyState
      icon={
        <svg
          className="w-16 h-16 text-red-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      }
      title={title}
      description={description}
      action={action || { label: 'Try again', onClick: () => window.location.reload() }}
    />
  );
}
