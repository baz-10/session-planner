'use client';

import { useState, useEffect } from 'react';
import { format, isPast } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { useEvents } from '@/hooks/use-events';
import { useSessions } from '@/hooks/use-sessions';
import { EventForm } from './event-form';
import { RsvpPanel } from './rsvp-panel';
import { AttendanceTracker } from './attendance-tracker';
import type { Event, Rsvp, Session, Player, Profile, AttendanceRecord } from '@/types/database';

interface RsvpWithDetails extends Rsvp {
  user?: Profile | null;
  player?: Player | null;
}

interface AttendanceRecordWithDetails extends AttendanceRecord {
  user?: Profile | null;
  player?: Player | null;
}

interface EventWithDetails extends Event {
  rsvps: RsvpWithDetails[];
  session?: Session | null;
  attendance_records?: AttendanceRecordWithDetails[];
}

interface EventDetailProps {
  eventId: string;
  onBack: () => void;
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  practice: '🏀',
  game: '🏆',
  tournament: '🎯',
  other: '📅',
};

export function EventDetail({ eventId, onBack }: EventDetailProps) {
  const { user, teamMemberships, currentTeam } = useAuth();
  const teamMembership = teamMemberships.find(m => m.team.id === currentTeam?.id);
  const { getEvent, deleteEvent, getRsvpCounts } = useEvents();
  const { getSession } = useSessions();

  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'rsvp' | 'attendance' | 'plan'>('rsvp');

  const isAdminOrCoach = teamMembership?.role === 'admin' || teamMembership?.role === 'coach';
  const isEventPast = event ? isPast(new Date(event.start_time)) : false;

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    setIsLoading(true);
    const data = await getEvent(eventId);
    setEvent(data);

    // Load session details if linked
    if (data?.session_id) {
      const session = await getSession(data.session_id);
      setSessionDetails(session);
    }

    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    const result = await deleteEvent(eventId);
    if (result.success) {
      onBack();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Event not found</p>
        <button onClick={onBack} className="mt-4 text-primary hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const counts = getRsvpCounts(event.rsvps);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {isAdminOrCoach && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditForm(true)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{EVENT_TYPE_ICONS[event.type]}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <p className="text-gray-500 capitalize">{event.type}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{format(new Date(event.start_time), 'EEEE, MMMM d, yyyy')}</span>
            </div>

            <div className="flex items-center gap-3 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {format(new Date(event.start_time), 'h:mm a')}
                {event.end_time && ` - ${format(new Date(event.end_time), 'h:mm a')}`}
              </span>
            </div>

            {event.meet_time && (
              <div className="flex items-center gap-3 text-orange-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Meet at {format(new Date(event.meet_time), 'h:mm a')}</span>
              </div>
            )}

            {event.location && (
              <div className="flex items-center gap-3 text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{event.location}</span>
              </div>
            )}

            {event.opponent && (
              <div className="flex items-center gap-3 text-gray-600">
                <span className="w-5 text-center">vs</span>
                <span className="font-medium">{event.opponent}</span>
              </div>
            )}
          </div>

          {/* RSVP Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-3">RSVP Summary</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600">{counts.going}</div>
                <div className="text-xs text-gray-500">Going</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-600">{counts.maybe}</div>
                <div className="text-xs text-gray-500">Maybe</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-2xl font-bold text-red-600">{counts.not_going}</div>
                <div className="text-xs text-gray-500">Can't Go</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-400">{counts.pending}</div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
            </div>
          </div>
        </div>

        {event.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('rsvp')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'rsvp'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              RSVP ({counts.total})
            </button>
            {isEventPast && isAdminOrCoach && (
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'attendance'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Attendance
              </button>
            )}
            {event.session_id && (
              <button
                onClick={() => setActiveTab('plan')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'plan'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Practice Plan
              </button>
            )}
          </nav>
        </div>

        <div className="p-4">
          {activeTab === 'rsvp' && (
            <RsvpPanel event={event} onUpdate={loadEvent} />
          )}

          {activeTab === 'attendance' && isAdminOrCoach && (
            <AttendanceTracker
              eventId={event.id}
              existingRecords={event.attendance_records || []}
              onUpdate={loadEvent}
            />
          )}

          {activeTab === 'plan' && sessionDetails && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{sessionDetails.name}</h3>
                {sessionDetails.duration && (
                  <span className="text-gray-500">{sessionDetails.duration} min</span>
                )}
              </div>

              {sessionDetails.activities?.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-4 py-2 text-left">Activity</th>
                        <th className="px-4 py-2 text-center">Duration</th>
                        <th className="px-4 py-2 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sessionDetails.activities.map((activity: any, index: number) => (
                        <tr key={activity.id}>
                          <td className="px-4 py-2 text-gray-500">{index + 1}</td>
                          <td className="px-4 py-2 font-medium">{activity.name}</td>
                          <td className="px-4 py-2 text-center">{activity.duration} min</td>
                          <td className="px-4 py-2 text-gray-500">{activity.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500">No activities in this plan yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit form modal */}
      {showEditForm && (
        <EventForm
          event={event}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => {
            setShowEditForm(false);
            loadEvent();
          }}
        />
      )}
    </div>
  );
}
