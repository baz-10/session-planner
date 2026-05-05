'use client';

import { useState } from 'react';
import { EventList, EventDetail } from '@/components/events';
import { MobileHeader, MobilePageShell } from '@/components/mobile';
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
      <MobilePageShell>
        <EventDetail
          eventId={selectedEvent.id}
          onBack={() => setSelectedEvent(null)}
        />
      </MobilePageShell>
    );
  }

  return (
    <MobilePageShell>
      <MobileHeader
        title="Events"
        subtitle="Games, practices, and RSVP status"
      />

      <EventList onSelectEvent={setSelectedEvent} />
    </MobilePageShell>
  );
}
