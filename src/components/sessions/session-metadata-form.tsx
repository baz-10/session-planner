'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@/types/database';

interface SessionMetadataFormProps {
  session?: Partial<Session>;
  onChange: (updates: Partial<Session>) => void;
  disabled?: boolean;
}

export function SessionMetadataForm({
  session,
  onChange,
  disabled = false,
}: SessionMetadataFormProps) {
  const [name, setName] = useState(session?.name || '');
  const [date, setDate] = useState(session?.date || '');
  const [startTime, setStartTime] = useState(session?.start_time || '');
  const [duration, setDuration] = useState(session?.duration?.toString() || '90');
  const [location, setLocation] = useState(session?.location || '');
  const [defensiveEmphasis, setDefensiveEmphasis] = useState(session?.defensive_emphasis || '');
  const [offensiveEmphasis, setOffensiveEmphasis] = useState(session?.offensive_emphasis || '');
  const [quote, setQuote] = useState(session?.quote || '');
  const [announcements, setAnnouncements] = useState(session?.announcements || '');

  // Update local state when session prop changes
  useEffect(() => {
    if (session) {
      setName(session.name || '');
      setDate(session.date || '');
      setStartTime(session.start_time || '');
      setDuration(session.duration?.toString() || '90');
      setLocation(session.location || '');
      setDefensiveEmphasis(session.defensive_emphasis || '');
      setOffensiveEmphasis(session.offensive_emphasis || '');
      setQuote(session.quote || '');
      setAnnouncements(session.announcements || '');
    }
  }, [session]);

  const handleChange = (field: keyof Session, value: string | number | null) => {
    onChange({ [field]: value });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Left Column - Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                handleChange('name', e.target.value);
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
              placeholder="Enter a plan name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Announcements</label>
            <textarea
              value={announcements}
              onChange={(e) => {
                setAnnouncements(e.target.value);
                handleChange('announcements', e.target.value || null);
              }}
              disabled={disabled}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 resize-none"
              placeholder="Team announcements..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quote of the Day</label>
            <textarea
              value={quote}
              onChange={(e) => {
                setQuote(e.target.value);
                handleChange('quote', e.target.value || null);
              }}
              disabled={disabled}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 resize-none"
              placeholder="Inspirational quote..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Defensive Emphasis</label>
            <input
              type="text"
              value={defensiveEmphasis}
              onChange={(e) => {
                setDefensiveEmphasis(e.target.value);
                handleChange('defensive_emphasis', e.target.value || null);
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
              placeholder="e.g., Staying in front"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offensive Emphasis</label>
            <input
              type="text"
              value={offensiveEmphasis}
              onChange={(e) => {
                setOffensiveEmphasis(e.target.value);
                handleChange('offensive_emphasis', e.target.value || null);
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
              placeholder="e.g., Ball movement"
            />
          </div>
        </div>

        {/* Middle Column - Date/Time */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                handleChange('date', e.target.value || null);
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                handleChange('location', e.target.value || null);
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
              placeholder="Gym location..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                handleChange('start_time', e.target.value || null);
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
            <select
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value);
                handleChange('duration', parseInt(e.target.value) || null);
              }}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
            >
              <option value="60">60 min (1 hour)</option>
              <option value="75">75 min (1h 15m)</option>
              <option value="90">90 min (1h 30m)</option>
              <option value="105">105 min (1h 45m)</option>
              <option value="120">120 min (2 hours)</option>
              <option value="150">150 min (2h 30m)</option>
              <option value="180">180 min (3 hours)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
