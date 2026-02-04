'use client';

import { useState, useEffect } from 'react';
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
  onUpdate: () => void;
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

  useEffect(() => {
    loadPlayers();
  }, [currentTeam?.id]);

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

  const loadPlayers = async () => {
    if (!currentTeam) return;

    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', currentTeam.id)
      .eq('status', 'active')
      .order('last_name');

    if (data) {
      setPlayers(data as Player[]);
    }
    setIsLoading(false);
  };

  const updatePlayerStatus = (playerId: string, status: AttendanceStatus) => {
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
    setIsSaving(true);

    const records = Array.from(attendance.values()).map((a) => ({
      playerId: a.playerId,
      status: a.status,
      notes: a.notes || undefined,
    }));

    const result = await recordAttendance(eventId, records);

    if (result.success) {
      onUpdate();
    }

    setIsSaving(false);
  };

  const markAllAs = (status: AttendanceStatus) => {
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
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No players on this team yet.</p>
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
      {/* Quick actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <span className="text-sm text-gray-500">Mark all as:</span>
          {ATTENDANCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => markAllAs(opt.value)}
              className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-2 text-center">
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
          <div key={player.playerId} className="p-3 flex items-center gap-4">
            {/* Player info */}
            <div className="w-48 flex items-center gap-2">
              {player.jerseyNumber && (
                <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {player.jerseyNumber}
                </span>
              )}
              <span className="font-medium">{player.playerName}</span>
            </div>

            {/* Status buttons */}
            <div className="flex gap-1">
              {ATTENDANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updatePlayerStatus(player.playerId, opt.value)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
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
              className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
