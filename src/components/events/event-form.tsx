'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useEvents } from '@/hooks/use-events';
import { useSessions } from '@/hooks/use-sessions';
import type { Event, Session, EventType, CreateEventInput } from '@/types/database';

interface EventFormProps {
  event?: Event | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EVENT_TYPES: { value: EventType; label: string; icon: string }[] = [
  { value: 'practice', label: 'Practice', icon: '🏀' },
  { value: 'game', label: 'Game', icon: '🏆' },
  { value: 'tournament', label: 'Tournament', icon: '🎯' },
  { value: 'other', label: 'Other', icon: '📅' },
];

export function EventForm({ event, onClose, onSuccess }: EventFormProps) {
  const { createEvent, updateEvent, isLoading } = useEvents();
  const { getSessions } = useSessions();

  const [type, setType] = useState<EventType>(event?.type || 'practice');
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [date, setDate] = useState(
    event?.start_time ? format(new Date(event.start_time), 'yyyy-MM-dd') : ''
  );
  const [startTime, setStartTime] = useState(
    event?.start_time ? format(new Date(event.start_time), 'HH:mm') : '17:00'
  );
  const [endTime, setEndTime] = useState(
    event?.end_time ? format(new Date(event.end_time), 'HH:mm') : ''
  );
  const [meetTime, setMeetTime] = useState(
    event?.meet_time ? format(new Date(event.meet_time), 'HH:mm') : ''
  );
  const [location, setLocation] = useState(event?.location || '');
  const [opponent, setOpponent] = useState(event?.opponent || '');
  const [sessionId, setSessionId] = useState(event?.session_id || '');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState('');

  const isEditing = !!event;

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const data = await getSessions();
    setSessions(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Event title is required');
      return;
    }

    if (!date) {
      setError('Event date is required');
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = endTime ? new Date(`${date}T${endTime}`) : null;
    const meetDateTime = meetTime ? new Date(`${date}T${meetTime}`) : null;

    const eventData: CreateEventInput = {
      team_id: '', // Will be set by hook
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime?.toISOString(),
      meet_time: meetDateTime?.toISOString(),
      opponent: type === 'game' || type === 'tournament' ? opponent.trim() || undefined : undefined,
      session_id: type === 'practice' && sessionId ? sessionId : undefined,
    };

    let result;
    if (isEditing && event) {
      result = await updateEvent(event.id, eventData);
    } else {
      result = await createEvent(eventData);
    }

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Failed to save event');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {isEditing ? 'Edit Event' : 'Create New Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                    type === t.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{t.icon}</span>
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={type === 'practice' ? 'Practice' : type === 'game' ? 'Game vs...' : 'Event name'}
              required
            />
          </div>

          {/* Date and Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meet Time
              </label>
              <input
                type="time"
                value={meetTime}
                onChange={(e) => setMeetTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Arrival time"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Where is this event?"
            />
          </div>

          {/* Opponent (for games/tournaments) */}
          {(type === 'game' || type === 'tournament') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opponent
              </label>
              <input
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="vs..."
              />
            </div>
          )}

          {/* Session Plan (for practices) */}
          {type === 'practice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link Practice Plan
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No plan linked</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Players can preview the practice plan when linked
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description / Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Additional details..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
