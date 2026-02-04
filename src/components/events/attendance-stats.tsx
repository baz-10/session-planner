'use client';

import { useState, useEffect } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useEvents } from '@/hooks/use-events';
import type { EventType } from '@/types/database';

interface AttendanceStatsProps {
  className?: string;
}

export function AttendanceStats({ className = '' }: AttendanceStatsProps) {
  const { getAttendanceStats } = useEvents();

  const [stats, setStats] = useState<{
    byPlayer: Array<{
      playerId: string;
      playerName: string;
      total: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      rate: number;
    }>;
    byEvent: Array<{
      eventId: string;
      eventTitle: string;
      eventDate: string;
      total: number;
      present: number;
      absent: number;
    }>;
    overall: {
      totalEvents: number;
      averageAttendance: number;
    };
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<EventType | ''>('');
  const [dateRange, setDateRange] = useState<'month' | '3months' | 'season'>('month');
  const [view, setView] = useState<'players' | 'events'>('players');

  useEffect(() => {
    loadStats();
  }, [filterType, dateRange]);

  const loadStats = async () => {
    setIsLoading(true);

    let startDate: string | undefined;
    let endDate: string | undefined;

    if (dateRange === 'month') {
      startDate = startOfMonth(new Date()).toISOString();
      endDate = endOfMonth(new Date()).toISOString();
    } else if (dateRange === '3months') {
      startDate = startOfMonth(subMonths(new Date(), 3)).toISOString();
      endDate = endOfMonth(new Date()).toISOString();
    }
    // 'season' = no date filter

    const data = await getAttendanceStats({
      eventType: filterType || undefined,
      startDate,
      endDate,
    });

    setStats(data);
    setIsLoading(false);
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-yellow-600';
    if (rate >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBarWidth = (rate: number) => {
    return `${Math.min(rate, 100)}%`;
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="text-center py-12 text-gray-500">
          <p>Unable to load attendance statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Attendance Statistics</h2>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView('players')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  view === 'players' ? 'bg-white shadow' : 'text-gray-500'
                }`}
              >
                By Player
              </button>
              <button
                onClick={() => setView('events')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  view === 'events' ? 'bg-white shadow' : 'text-gray-500'
                }`}
              >
                By Event
              </button>
            </div>

            {/* Date range filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'month' | '3months' | 'season')}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="month">This Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="season">All Season</option>
            </select>

            {/* Event type filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as EventType | '')}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Events</option>
              <option value="practice">Practices</option>
              <option value="game">Games</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overall stats */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-primary">{stats.overall.totalEvents}</div>
            <div className="text-sm text-gray-500">Total Events</div>
          </div>
          <div>
            <div className={`text-3xl font-bold ${getAttendanceColor(stats.overall.averageAttendance)}`}>
              {stats.overall.averageAttendance}%
            </div>
            <div className="text-sm text-gray-500">Average Attendance</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {view === 'players' ? (
          stats.byPlayer.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No attendance data available.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.byPlayer.map((player) => (
                <div key={player.playerId} className="flex items-center gap-4">
                  <div className="w-40 font-medium truncate">{player.playerName}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          player.rate >= 90
                            ? 'bg-green-500'
                            : player.rate >= 75
                            ? 'bg-yellow-500'
                            : player.rate >= 50
                            ? 'bg-orange-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: getBarWidth(player.rate) }}
                      />
                    </div>
                  </div>
                  <div className={`w-16 text-right font-bold ${getAttendanceColor(player.rate)}`}>
                    {player.rate}%
                  </div>
                  <div className="w-24 text-right text-sm text-gray-500">
                    {player.present + player.late}/{player.total}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : stats.byEvent.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No events with attendance data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Event</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">Present</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">Absent</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.byEvent.map((event) => {
                  const rate = event.total > 0 ? Math.round((event.present / event.total) * 100) : 0;
                  return (
                    <tr key={event.eventId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{event.eventTitle}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {format(new Date(event.eventDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">
                        {event.present}
                      </td>
                      <td className="px-4 py-3 text-center text-red-600 font-medium">
                        {event.absent}
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${getAttendanceColor(rate)}`}>
                        {rate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
