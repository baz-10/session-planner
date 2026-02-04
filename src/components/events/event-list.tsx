'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { useEvents } from '@/hooks/use-events';
import { EventCard } from './event-card';
import { EventForm } from './event-form';
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
  const { getEvents } = useEvents();
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('upcoming')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'upcoming' ? 'bg-white shadow' : 'text-gray-500'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'month' ? 'bg-white shadow' : 'text-gray-500'
              }`}
            >
              Calendar
            </button>
          </div>

          {/* Month navigation (for calendar view) */}
          {view === 'month' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-medium min-w-[140px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Filter by type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EventType | '')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light"
            >
              Create Event
            </button>
          </div>
        </div>
      </div>

      {/* Events */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h2 className="text-xl font-semibold mb-2">No Events</h2>
          <p className="text-gray-600 mb-6">
            {view === 'upcoming'
              ? 'No upcoming events scheduled.'
              : 'No events for this month.'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-light"
          >
            Create Your First Event
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onRsvp={loadEvents}
              onClick={onSelectEvent ? () => onSelectEvent(event) : undefined}
            />
          ))}
        </div>
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
