'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useEvents } from '@/hooks/use-events';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type { AttendanceRecord, Player, Profile, AttendanceStatus } from '@/types/database';

interface AttendanceRecordWithDetails extends AttendanceRecord {
  user?: Profile | null;
  player?: Player | null;
}

interface AttendanceTrackerProps {
  eventId: string;
  existingRecords: AttendanceRecordWithDetails[];
  onUpdate: () => void | Promise<void>;
}

interface PlayerAttendance {
  playerId: string;
  playerName: string;
  jerseyNumber: string | null;
  status: AttendanceStatus;
  notes: string;
}

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'present', label: 'Present', color: 'bg-green-100 text-green-700' },
  { value: 'late', label: 'Late', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700' },
  { value: 'excused', label: 'Excused', color: 'bg-gray-100 text-gray-700' },
];

export function AttendanceTracker({
  eventId,
  existingRecords,
  onUpdate,
}: AttendanceTrackerProps) {
  const { currentTeam } = useAuth();
  const { recordAttendance } = useEvents();
  const supabase = getBrowserSupabaseClient();

  const [players, setPlayers] = useState<Player[]>([]);
  const [attendance, setAttendance] = useState<Map<string, PlayerAttendance>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const loadPlayers = useCallback(async () => {
    if (!currentTeam) {
      setPlayers([]);
      setLoadError('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError('');

    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', currentTeam.id)
        .eq('status', 'active')
        .order('last_name');

      if (error) {
        console.error('Error loading players for attendance:', error);
        setPlayers([]);
        setLoadError('Players could not load for attendance. Refresh and try again.');
        return;
      }

      setPlayers((data || []) as Player[]);
    } catch (error) {
      console.error('Unexpected error loading players for attendance:', error);
      setPlayers([]);
      setLoadError('Players could not load for attendance. Refresh and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentTeam, supabase]);

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  useEffect(() => {
    // Initialize attendance from existing records
    const map = new Map<string, PlayerAttendance>();

    players.forEach((player) => {
      const existing = existingRecords.find((r) => r.player_id === player.id);
      map.set(player.id, {
        playerId: player.id,
        playerName: `${player.first_name} ${player.last_name}`,
        jerseyNumber: player.jersey_number,
        status: existing?.status || 'present',
        notes: existing?.notes || '',
      });
    });

    setAttendance(map);
  }, [players, existingRecords]);

  const updatePlayerStatus = (playerId: string, status: AttendanceStatus) => {
    setSaveMessage('');
    setAttendance((prev) => {
      const newMap = new Map(prev);
      const player = newMap.get(playerId);
      if (player) {
        newMap.set(playerId, { ...player, status });
      }
      return newMap;
    });
  };

  const updatePlayerNotes = (playerId: string, notes: string) => {
    setSaveMessage('');
    setAttendance((prev) => {
      const newMap = new Map(prev);
      const player = newMap.get(playerId);
      if (player) {
        newMap.set(playerId, { ...player, notes });
      }
      return newMap;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveError('');
    setSaveMessage('');

    const records = Array.from(attendance.values()).map((a) => ({
      playerId: a.playerId,
      status: a.status,
      notes: a.notes || undefined,
    }));

    try {
      const result = await recordAttendance(eventId, records);

      if (result.success) {
        await onUpdate();
        setSaveMessage('Attendance saved.');
      } else {
        setSaveError(result.error || 'Failed to save attendance.');
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
      setSaveError('Failed to save attendance. Refresh and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const markAllAs = (status: AttendanceStatus) => {
    if (isSaving) return;

    setSaveMessage('');
    setAttendance((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((player, id) => {
        newMap.set(id, { ...player, status });
      });
      return newMap;
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center" role="status" aria-label="Loading attendance">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" aria-hidden="true"></div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {loadError ? (
          <div role="alert" className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadPlayers()}
              className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-bold text-red-700 shadow-sm hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : (
          <p>No players on this team yet.</p>
        )}
      </div>
    );
  }

  const stats = {
    present: Array.from(attendance.values()).filter((a) => a.status === 'present').length,
    late: Array.from(attendance.values()).filter((a) => a.status === 'late').length,
    absent: Array.from(attendance.values()).filter((a) => a.status === 'absent').length,
    excused: Array.from(attendance.values()).filter((a) => a.status === 'excused').length,
  };

  return (
    <div className="space-y-4">
      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {saveError}
        </div>
      )}
      {saveMessage && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {saveMessage}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-sm text-gray-500 sm:w-auto">Mark all as:</span>
          {ATTENDANCE_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => markAllAs(opt.value)}
              disabled={isSaving}
              aria-busy={isSaving}
              className="min-h-10 rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          aria-busy={isSaving}
          className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-light disabled:opacity-50 sm:w-auto"
        >
          {isSaving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="bg-green-50 rounded-lg p-2">
          <div className="text-lg font-bold text-green-600">{stats.present}</div>
          <div className="text-xs text-gray-500">Present</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-2">
          <div className="text-lg font-bold text-yellow-600">{stats.late}</div>
          <div className="text-xs text-gray-500">Late</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-lg font-bold text-red-600">{stats.absent}</div>
          <div className="text-xs text-gray-500">Absent</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-lg font-bold text-gray-600">{stats.excused}</div>
          <div className="text-xs text-gray-500">Excused</div>
        </div>
      </div>

      {/* Player list */}
      <div className="border rounded-lg divide-y">
        {Array.from(attendance.values()).map((player) => (
          <div key={player.playerId} className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:gap-4">
            {/* Player info */}
            <div className="flex min-w-0 items-center gap-2 md:w-48 md:shrink-0">
              {player.jerseyNumber && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {player.jerseyNumber}
                </span>
              )}
              <span className="truncate font-medium">{player.playerName}</span>
            </div>

            {/* Status buttons */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:flex md:gap-1">
              {ATTENDANCE_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => updatePlayerStatus(player.playerId, opt.value)}
                  disabled={isSaving}
                  aria-busy={isSaving}
                  aria-pressed={player.status === opt.value}
                  className={`min-h-10 rounded px-3 py-1 text-sm font-medium transition-colors ${
                    player.status === opt.value
                      ? opt.color.replace('100', '500').replace('700', 'white')
                      : opt.color + ' hover:opacity-80'
                  } ${player.status === opt.value ? 'ring-2 ring-offset-1' : ''}`}
                  style={
                    player.status === opt.value
                      ? {
                          backgroundColor:
                            opt.value === 'present'
                              ? '#22c55e'
                              : opt.value === 'late'
                              ? '#eab308'
                              : opt.value === 'absent'
                              ? '#ef4444'
                              : '#6b7280',
                          color: 'white',
                        }
                      : undefined
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Notes */}
            <input
              type="text"
              value={player.notes}
              onChange={(e) => updatePlayerNotes(player.playerId, e.target.value)}
              placeholder="Notes..."
              disabled={isSaving}
              aria-label={`Attendance notes for ${player.playerName}`}
              className="min-h-10 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary md:flex-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
