'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useEvents } from '@/hooks/use-events';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type { Event, Rsvp, Player, Profile, RsvpStatus } from '@/types/database';

interface RsvpWithDetails extends Rsvp {
  user?: Profile | null;
  player?: Player | null;
}

interface EventWithDetails extends Event {
  rsvps: RsvpWithDetails[];
}

interface RsvpPanelProps {
  event: EventWithDetails;
  onUpdate: () => void | Promise<void>;
}

interface LinkedPlayer {
  player_id: string;
  player: Player;
}

export function RsvpPanel({ event, onUpdate }: RsvpPanelProps) {
  const { user, teamMemberships, currentTeam } = useAuth();
  const teamMembership = teamMemberships.find(m => m.team.id === currentTeam?.id);
  const { submitRsvp, getUserRsvp } = useEvents();
  const supabase = getBrowserSupabaseClient();

  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<RsvpStatus | 'all'>('all');
  const [rsvpError, setRsvpError] = useState('');
  const [linkedPlayersError, setLinkedPlayersError] = useState('');

  const isParent = teamMembership?.role === 'parent';

  const loadLinkedPlayers = useCallback(async () => {
    if (!user || !currentTeam?.id) {
      setLinkedPlayers([]);
      return;
    }

    setLinkedPlayersError('');
    const { data, error } = await supabase
      .from('parent_player_links')
      .select(`
        player_id,
        player:players!inner(*)
      `)
      .eq('parent_user_id', user.id)
      .eq('can_rsvp', true)
      .eq('player.team_id', currentTeam.id);

    if (error) {
      console.error('Error loading linked players for RSVP:', error);
      setLinkedPlayers([]);
      setLinkedPlayersError('Your linked players could not load. Refresh and try again.');
      return;
    }

    if (data) {
      setLinkedPlayers(data as LinkedPlayer[]);
    }
  }, [currentTeam?.id, supabase, user]);

  useEffect(() => {
    if (isParent) {
      void loadLinkedPlayers();
    } else {
      setLinkedPlayers([]);
    }
  }, [isParent, loadLinkedPlayers]);

  const handleRsvp = async (status: RsvpStatus, playerId?: string) => {
    setIsSubmitting(true);
    setRsvpError('');
    try {
      const result = await submitRsvp(event.id, status, { playerId });

      if (!result.success) {
        setRsvpError(result.error || 'Failed to submit RSVP.');
        return;
      }

      await onUpdate();
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      setRsvpError('Failed to submit RSVP. Refresh and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userRsvp = getUserRsvp(event.rsvps);

  const filteredRsvps = filter === 'all'
    ? event.rsvps
    : event.rsvps.filter((r) => r.status === filter);

  const groupedRsvps = {
    going: event.rsvps.filter((r) => r.status === 'going'),
    maybe: event.rsvps.filter((r) => r.status === 'maybe'),
    not_going: event.rsvps.filter((r) => r.status === 'not_going'),
    pending: event.rsvps.filter((r) => r.status === 'pending'),
  };

  return (
    <div className="space-y-6">
      {rsvpError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {rsvpError}
        </div>
      )}

      {/* User's own RSVP (if not parent) */}
      {!isParent && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-3">Your Response</h4>
          <div className="flex gap-2">
            {(['going', 'maybe', 'not_going'] as RsvpStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleRsvp(status)}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                aria-pressed={userRsvp?.status === status}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                  userRsvp?.status === status
                    ? status === 'going'
                      ? 'bg-green-500 text-white'
                      : status === 'maybe'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-red-500 text-white'
                    : status === 'going'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : status === 'maybe'
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : "Can't Go"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Parent RSVP for linked players */}
      {isParent && linkedPlayersError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {linkedPlayersError}
        </div>
      )}

      {isParent && linkedPlayers.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">RSVP for Your Players</h4>
          {linkedPlayers.map(({ player_id, player }) => {
            const playerRsvp = event.rsvps.find((r) => r.player_id === player_id);
            return (
              <div key={player_id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">
                    {player.first_name} {player.last_name}
                  </span>
                  {player.jersey_number && (
                    <span className="text-sm text-gray-500">#{player.jersey_number}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {(['going', 'maybe', 'not_going'] as RsvpStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleRsvp(status, player_id)}
                      disabled={isSubmitting}
                      aria-busy={isSubmitting}
                      aria-pressed={playerRsvp?.status === status}
                      className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                        playerRsvp?.status === status
                          ? status === 'going'
                            ? 'bg-green-500 text-white'
                            : status === 'maybe'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-red-500 text-white'
                          : status === 'going'
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : status === 'maybe'
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : "Can't Go"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isParent && !linkedPlayersError && linkedPlayers.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          No linked players are available for this team.
        </div>
      )}

      {/* RSVP List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">All Responses</h4>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as RsvpStatus | 'all')}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All ({event.rsvps.length})</option>
            <option value="going">Going ({groupedRsvps.going.length})</option>
            <option value="maybe">Maybe ({groupedRsvps.maybe.length})</option>
            <option value="not_going">Can&apos;t Go ({groupedRsvps.not_going.length})</option>
            <option value="pending">Pending ({groupedRsvps.pending.length})</option>
          </select>
        </div>

        {filteredRsvps.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No responses yet</p>
        ) : (
          <div className="space-y-2">
            {filteredRsvps.map((rsvp) => {
              const name = rsvp.player
                ? `${rsvp.player.first_name} ${rsvp.player.last_name}`
                : rsvp.user?.full_name || 'Unknown';

              return (
                <div
                  key={rsvp.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center text-sm font-medium">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{name}</div>
                      {rsvp.response_note && (
                        <div className="text-sm text-gray-500">{rsvp.response_note}</div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      rsvp.status === 'going'
                        ? 'bg-green-100 text-green-700'
                        : rsvp.status === 'maybe'
                        ? 'bg-yellow-100 text-yellow-700'
                        : rsvp.status === 'not_going'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {rsvp.status === 'going'
                      ? 'Going'
                      : rsvp.status === 'maybe'
                      ? 'Maybe'
                      : rsvp.status === 'not_going'
                      ? "Can't Go"
                      : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
