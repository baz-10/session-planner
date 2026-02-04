'use client';

import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { useEvents } from '@/hooks/use-events';
import type { Event, Rsvp, Session, Player, Profile, RsvpStatus } from '@/types/database';

interface RsvpWithDetails extends Rsvp {
  user?: Profile | null;
  player?: Player | null;
}

interface EventWithDetails extends Event {
  rsvps: RsvpWithDetails[];
  session?: Session | null;
}

interface EventCardProps {
  event: EventWithDetails;
  onRsvp?: () => void;
  onClick?: () => void;
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  practice: '🏀',
  game: '🏆',
  tournament: '🎯',
  other: '📅',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  practice: 'bg-blue-100 text-blue-800',
  game: 'bg-green-100 text-green-800',
  tournament: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
};

export function EventCard({ event, onRsvp, onClick }: EventCardProps) {
  const { user } = useAuth();
  const { getRsvpCounts, getUserRsvp, submitRsvp } = useEvents();

  const eventDate = new Date(event.start_time);
  const isEventPast = isPast(eventDate);
  const counts = getRsvpCounts(event.rsvps);
  const userRsvp = getUserRsvp(event.rsvps);

  const formatEventDate = () => {
    if (isToday(eventDate)) return 'Today';
    if (isTomorrow(eventDate)) return 'Tomorrow';
    return format(eventDate, 'EEE, MMM d');
  };

  const handleRsvp = async (status: RsvpStatus) => {
    await submitRsvp(event.id, status);
    onRsvp?.();
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md overflow-hidden ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
      } ${isEventPast ? 'opacity-75' : ''}`}
    >
      {/* Header with type badge */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
              EVENT_TYPE_COLORS[event.type]
            }`}
          >
            <span>{EVENT_TYPE_ICONS[event.type]}</span>
            <span className="capitalize">{event.type}</span>
          </span>
          {event.session && (
            <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              📋 Plan attached
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500">{formatEventDate()}</span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 mb-1">{event.title}</h3>

        <div className="space-y-1 text-sm text-gray-600 mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {format(eventDate, 'h:mm a')}
              {event.end_time && ` - ${format(new Date(event.end_time), 'h:mm a')}`}
            </span>
          </div>

          {event.meet_time && (
            <div className="flex items-center gap-2 text-orange-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Meet at {format(new Date(event.meet_time), 'h:mm a')}</span>
            </div>
          )}

          {event.location && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{event.location}</span>
            </div>
          )}

          {event.opponent && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">vs</span>
              <span className="font-medium">{event.opponent}</span>
            </div>
          )}
        </div>

        {/* RSVP Summary */}
        <div className="flex items-center justify-between py-2 border-t border-gray-100">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600 font-medium">
              ✓ {counts.going}
            </span>
            <span className="text-red-600 font-medium">
              ✗ {counts.not_going}
            </span>
            <span className="text-yellow-600 font-medium">
              ? {counts.maybe}
            </span>
          </div>

          {!isEventPast && (
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRsvp('going');
                }}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  userRsvp?.status === 'going'
                    ? 'bg-green-500 text-white'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                Going
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRsvp('maybe');
                }}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  userRsvp?.status === 'maybe'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
              >
                Maybe
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRsvp('not_going');
                }}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  userRsvp?.status === 'not_going'
                    ? 'bg-red-500 text-white'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                Can't Go
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
