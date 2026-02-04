'use client';

import { useState } from 'react';
import { EventList, EventDetail } from '@/components/events';
import type { Event, Rsvp, Session, Player, Profile } from '@/types/database';

interface RsvpWithDetails extends Rsvp {
  user?: Profile | null;
  player?: Player | null;
}

interface EventWithDetails extends Event {
  rsvps: RsvpWithDetails[];
  session?: Session | null;
}

export default function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);

  if (selectedEvent) {
    return (
      <div className="p-8">
        <EventDetail
          eventId={selectedEvent.id}
          onBack={() => setSelectedEvent(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-navy mb-2">Events</h1>
        <p className="text-text-secondary">Manage practices, games, and team events</p>
      </div>

      <EventList onSelectEvent={setSelectedEvent} />
    </div>
  );
}
