'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  HelpCircle,
  MapPin,
  Plus,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useEvents } from '@/hooks/use-events';
import { EventCard } from './event-card';
import { EventForm } from './event-form';
import {
  MobileEmptyState,
  MobileListCard,
  MobileLoadingState,
  MobileSegmentedControl,
} from '@/components/mobile';
import type { Event, Rsvp, Session, Player, Profile, EventType } from '@/types/database';

interface RsvpWithDetails extends Rsvp {
  user?: Profile | null;
  player?: Player | null;
}

interface EventWithDetails extends Event {
  rsvps: RsvpWithDetails[];
  session?: Session | null;
}

interface EventListProps {
  onSelectEvent?: (event: EventWithDetails) => void;
}

export function EventList({ onSelectEvent }: EventListProps) {
  const { getEvents, getRsvpCounts, getUserRsvp } = useEvents();
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<EventType | ''>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<'upcoming' | 'month'>('upcoming');

  const loadEvents = useCallback(async () => {
    setIsLoading(true);

    let options: any = {};

    if (filterType) {
      options.type = filterType;
    }

    if (view === 'upcoming') {
      options.upcoming = true;
    } else {
      options.startDate = startOfMonth(currentMonth).toISOString();
      options.endDate = endOfMonth(currentMonth).toISOString();
    }

    const data = await getEvents(options);
    setEvents(data);
    setIsLoading(false);
  }, [getEvents, filterType, view, currentMonth]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const nextEvent = events[0];
  const nextEventDate = nextEvent ? new Date(nextEvent.start_time) : null;
  const nextEventCounts = nextEvent ? getRsvpCounts(nextEvent.rsvps) : null;
  const nextEventUserRsvp = nextEvent ? getUserRsvp(nextEvent.rsvps) : null;
  const totalResponses = nextEventCounts
    ? nextEventCounts.going + nextEventCounts.maybe + nextEventCounts.not_going
    : 0;
  const attendanceRate =
    nextEventCounts && nextEventCounts.total > 0
      ? Math.round((nextEventCounts.going / nextEventCounts.total) * 100)
      : null;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <MobileListCard>
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
          {/* View toggle */}
          <MobileSegmentedControl
            value={view}
            onChange={setView}
            className="md:w-[280px]"
            options={[
              { value: 'upcoming', label: 'Upcoming', icon: <CalendarDays className="h-4 w-4" /> },
              { value: 'month', label: 'Calendar', icon: <Clock3 className="h-4 w-4" /> },
            ]}
          />

          {/* Month navigation (for calendar view) */}
          {view === 'month' && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 px-2 py-1">
              <button
                onClick={handlePrevMonth}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[140px] text-center text-sm font-extrabold text-navy">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <button
                onClick={handleNextMonth}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Filter by type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EventType | '')}
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Events</option>
              <option value="practice">Practices</option>
              <option value="game">Games</option>
              <option value="tournament">Tournaments</option>
              <option value="other">Other</option>
            </select>

            {/* Create button */}
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-teal px-4 text-sm font-extrabold text-white"
            >
              <Plus className="h-4 w-4" />
              Create Event
            </button>
          </div>
        </div>
      </MobileListCard>

      {/* Events */}
      {isLoading ? (
        <MobileLoadingState label="Loading events" className="min-h-[240px]" />
      ) : events.length === 0 ? (
        <MobileEmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title="No events"
          description={
            view === 'upcoming'
              ? 'No upcoming events scheduled.'
              : 'No events for this month.'
          }
          action={
            <button
              onClick={() => setShowForm(true)}
              className="btn-accent"
            >
              Create Your First Event
            </button>
          }
        />
      ) : (
        <>
          {nextEvent && nextEventDate && nextEventCounts && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <MobileListCard className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-teal">Next Event</div>
                    <h2 className="mt-1 line-clamp-2 text-2xl font-extrabold text-navy">
                      {nextEvent.title}
                    </h2>
                    <div className="mt-2 inline-flex rounded-full bg-teal-glow px-3 py-1 text-xs font-extrabold capitalize text-teal-dark">
                      {nextEvent.type}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-navy px-3 py-2 text-center text-white">
                    <div className="text-xs font-bold uppercase tracking-normal text-white/70">
                      RSVP
                    </div>
                    <div className="mt-1 text-sm font-extrabold capitalize">
                      {nextEventUserRsvp?.status?.replace('_', ' ') || 'Pending'}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-2">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-teal" />
                    {format(nextEventDate, 'EEE, MMM d')}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-teal" />
                    {format(nextEventDate, 'h:mm a')}
                    {nextEvent.end_time && ` - ${format(new Date(nextEvent.end_time), 'h:mm a')}`}
                  </span>
                  {nextEvent.meet_time && (
                    <span className="inline-flex items-center gap-2 text-amber-700">
                      <Clock3 className="h-4 w-4" />
                      Meet {format(new Date(nextEvent.meet_time), 'h:mm a')}
                    </span>
                  )}
                  {nextEvent.location && (
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-teal" />
                      <span className="truncate">{nextEvent.location}</span>
                    </span>
                  )}
                </div>
              </MobileListCard>

              <MobileListCard>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-extrabold text-navy">RSVP Summary</h2>
                  <span className="text-sm font-bold text-slate-500">
                    {totalResponses} responses
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-emerald-50 px-2 py-3">
                    <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
                    <div className="mt-1 text-2xl font-extrabold text-emerald-700">
                      {nextEventCounts.going}
                    </div>
                    <div className="text-xs font-bold text-emerald-700">Going</div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-2 py-3">
                    <HelpCircle className="mx-auto h-5 w-5 text-amber-600" />
                    <div className="mt-1 text-2xl font-extrabold text-amber-700">
                      {nextEventCounts.maybe}
                    </div>
                    <div className="text-xs font-bold text-amber-700">Maybe</div>
                  </div>
                  <div className="rounded-2xl bg-red-50 px-2 py-3">
                    <XCircle className="mx-auto h-5 w-5 text-red-600" />
                    <div className="mt-1 text-2xl font-extrabold text-red-700">
                      {nextEventCounts.not_going}
                    </div>
                    <div className="text-xs font-bold text-red-700">Not Going</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-navy">
                    <TrendingUp className="h-4 w-4 text-teal" />
                    Attendance trend
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-teal"
                      style={{ width: `${attendanceRate || 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    {attendanceRate === null
                      ? 'No RSVP baseline yet.'
                      : `${attendanceRate}% marked going for the next event.`}
                  </p>
                </div>
              </MobileListCard>
            </div>
          )}

          <section>
            <h2 className="mb-3 text-xl font-extrabold text-navy">Upcoming Events</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRsvp={loadEvents}
                  onClick={onSelectEvent ? () => onSelectEvent(event) : undefined}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Event form modal */}
      {showForm && (
        <EventForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}
