'use client';

import { format, isPast, isToday, isTomorrow } from 'date-fns';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  HelpCircle,
  MapPin,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
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

const EVENT_TYPE_COLORS: Record<string, string> = {
  practice: 'bg-blue-50 text-blue-700 border-blue-100',
  game: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  tournament: 'bg-violet-50 text-violet-700 border-violet-100',
  other: 'bg-slate-50 text-slate-700 border-slate-100',
};

export function EventCard({ event, onRsvp, onClick }: EventCardProps) {
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

  const TypeIcon =
    event.type === 'game'
      ? Trophy
      : event.type === 'tournament'
        ? Trophy
        : event.type === 'practice'
          ? Users
          : CalendarDays;

  return (
    <div
      onClick={onClick}
      className={`overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,31,51,0.07)] ${
        onClick ? 'cursor-pointer transition hover:border-teal hover:shadow-lg' : ''
      } ${isEventPast ? 'opacity-75' : ''}`}
    >
      {/* Header with type badge */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-extrabold capitalize ${
              EVENT_TYPE_COLORS[event.type]
            }`}
          >
            <TypeIcon className="h-3.5 w-3.5" />
            {event.type}
          </span>
          {event.session && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">
              Plan attached
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-slate-500">{formatEventDate()}</span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="mb-3 line-clamp-2 text-lg font-extrabold leading-6 text-navy">
          {event.title}
        </h3>

        <div className="mb-4 space-y-2 text-sm font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-teal" />
            <span>
              {format(eventDate, 'h:mm a')}
              {event.end_time && ` - ${format(new Date(event.end_time), 'h:mm a')}`}
            </span>
          </div>

          {event.meet_time && (
            <div className="flex items-center gap-2 text-amber-700">
              <Clock3 className="h-4 w-4" />
              <span>Meet at {format(new Date(event.meet_time), 'h:mm a')}</span>
            </div>
          )}

          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-teal" />
              <span className="truncate">{event.location}</span>
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
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {counts.going}
            </span>
            <span className="inline-flex items-center gap-1 font-extrabold text-red-600">
              <XCircle className="h-4 w-4" />
              {counts.not_going}
            </span>
            <span className="inline-flex items-center gap-1 font-extrabold text-amber-600">
              <HelpCircle className="h-4 w-4" />
              {counts.maybe}
            </span>
          </div>

          {!isEventPast && (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRsvp('going');
                }}
                className={`min-h-10 rounded-xl text-xs font-extrabold transition-colors ${
                  userRsvp?.status === 'going'
                    ? 'bg-green-500 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                Going
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRsvp('maybe');
                }}
                className={`min-h-10 rounded-xl text-xs font-extrabold transition-colors ${
                  userRsvp?.status === 'maybe'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                }`}
              >
                Maybe
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRsvp('not_going');
                }}
                className={`min-h-10 rounded-xl text-xs font-extrabold transition-colors ${
                  userRsvp?.status === 'not_going'
                    ? 'bg-red-500 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                Not Going
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
