'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type {
  Event,
  Rsvp,
  AttendanceRecord,
  Session,
  Player,
  Profile,
  CreateEventInput,
  EventType,
  RsvpStatus,
  AttendanceStatus,
} from '@/types/database';

interface RsvpWithDetails extends Rsvp {
  user?: Profile | null;
  player?: Player | null;
}

interface EventWithDetails extends Event {
  rsvps: RsvpWithDetails[];
  session?: Session | null;
  attendance_records?: AttendanceRecordWithDetails[];
}

interface AttendanceRecordWithDetails extends AttendanceRecord {
  user?: Profile | null;
  player?: Player | null;
}

interface RsvpCounts {
  going: number;
  not_going: number;
  maybe: number;
  pending: number;
  total: number;
}

export function useEvents() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Get all events for the current team
   */
  const getEvents = useCallback(
    async (options?: {
      type?: EventType;
      startDate?: string;
      endDate?: string;
      upcoming?: boolean;
    }): Promise<EventWithDetails[]> => {
      if (!currentTeam) return [];

      let query = supabase
        .from('events')
        .select(`
          *,
          session:sessions(*),
          rsvps(*, user:profiles!user_id(*), player:players!player_id(*))
        `)
        .eq('team_id', currentTeam.id)
        .order('start_time', { ascending: true });

      if (options?.type) {
        query = query.eq('type', options.type);
      }

      if (options?.upcoming) {
        query = query.gte('start_time', new Date().toISOString());
      }

      if (options?.startDate) {
        query = query.gte('start_time', options.startDate);
      }

      if (options?.endDate) {
        query = query.lte('start_time', options.endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching events:', error);
        return [];
      }

      return data as EventWithDetails[];
    },
    [supabase, currentTeam]
  );

  /**
   * Get a single event by ID
   */
  const getEvent = useCallback(
    async (eventId: string): Promise<EventWithDetails | null> => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          session:sessions(*),
          rsvps(*, user:profiles!user_id(*), player:players!player_id(*)),
          attendance_records(*, user:profiles!user_id(*), player:players!player_id(*))
        `)
        .eq('id', eventId)
        .single();

      if (error) {
        console.error('Error fetching event:', error);
        return null;
      }

      return data as EventWithDetails;
    },
    [supabase]
  );

  /**
   * Create a new event
   */
  const createEvent = useCallback(
    async (input: CreateEventInput): Promise<{ success: boolean; event?: Event; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated or no team selected' };
      }

      setIsLoading(true);

      const { data, error } = await supabase
        .from('events')
        .insert({
          team_id: currentTeam.id,
          type: input.type,
          title: input.title,
          description: input.description || null,
          location: input.location || null,
          start_time: input.start_time,
          meet_time: input.meet_time || null,
          end_time: input.end_time || null,
          duration: input.duration || null,
          session_id: input.session_id || null,
          rsvp_limit: input.rsvp_limit || null,
          rsvp_deadline: input.rsvp_deadline || null,
          opponent: input.opponent || null,
          created_by: user.id,
        })
        .select()
        .single();

      setIsLoading(false);

      if (error || !data) {
        console.error('Error creating event:', error);
        return { success: false, error: 'Failed to create event' };
      }

      return { success: true, event: data as Event };
    },
    [user, currentTeam, supabase]
  );

  /**
   * Update an event
   */
  const updateEvent = useCallback(
    async (
      eventId: string,
      updates: Partial<Event>
    ): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);

      const { error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', eventId);

      setIsLoading(false);

      if (error) {
        console.error('Error updating event:', error);
        return { success: false, error: 'Failed to update event' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Delete an event
   */
  const deleteEvent = useCallback(
    async (
      eventId: string,
      options?: { deleteSeries?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      let deleteError: { message?: string } | null = null;

      if (options?.deleteSeries) {
        const { data: sourceEvent, error: lookupError } = await supabase
          .from('events')
          .select('recurrence_series_id')
          .eq('id', eventId)
          .single();

        if (lookupError) {
          console.error('Error loading event for delete:', lookupError);
          return { success: false, error: 'Failed to load event before deleting' };
        }

        if (sourceEvent?.recurrence_series_id) {
          const { error } = await supabase
            .from('events')
            .delete()
            .eq('recurrence_series_id', sourceEvent.recurrence_series_id);
          deleteError = error;
        } else {
          const { error } = await supabase.from('events').delete().eq('id', eventId);
          deleteError = error;
        }
      } else {
        const { error } = await supabase.from('events').delete().eq('id', eventId);
        deleteError = error;
      }

      if (deleteError) {
        console.error('Error deleting event:', deleteError);
        return { success: false, error: 'Failed to delete event' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Submit RSVP for user or player
   */
  const submitRsvp = useCallback(
    async (
      eventId: string,
      status: RsvpStatus,
      options?: {
        playerId?: string;
        note?: string;
      }
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check if RSVP exists
      let query = supabase
        .from('rsvps')
        .select('id')
        .eq('event_id', eventId);

      if (options?.playerId) {
        query = query.eq('player_id', options.playerId);
      } else {
        query = query.eq('user_id', user.id).is('player_id', null);
      }

      const { data: existing } = await query.single();

      if (existing) {
        // Update existing RSVP
        const { error } = await supabase
          .from('rsvps')
          .update({
            status,
            response_note: options?.note || null,
            responded_by: user.id,
            responded_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating RSVP:', error);
          return { success: false, error: 'Failed to update RSVP' };
        }
      } else {
        // Create new RSVP
        const { error } = await supabase.from('rsvps').insert({
          event_id: eventId,
          user_id: options?.playerId ? null : user.id,
          player_id: options?.playerId || null,
          status,
          response_note: options?.note || null,
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        });

        if (error) {
          console.error('Error creating RSVP:', error);
          return { success: false, error: 'Failed to submit RSVP' };
        }
      }

      return { success: true };
    },
    [user, supabase]
  );

  /**
   * Get RSVP counts for an event
   */
  const getRsvpCounts = useCallback((rsvps: RsvpWithDetails[]): RsvpCounts => {
    return {
      going: rsvps.filter((r) => r.status === 'going').length,
      not_going: rsvps.filter((r) => r.status === 'not_going').length,
      maybe: rsvps.filter((r) => r.status === 'maybe').length,
      pending: rsvps.filter((r) => r.status === 'pending').length,
      total: rsvps.length,
    };
  }, []);

  /**
   * Get user's RSVP status for an event
   */
  const getUserRsvp = useCallback(
    (rsvps: RsvpWithDetails[], playerId?: string): RsvpWithDetails | undefined => {
      if (!user) return undefined;

      if (playerId) {
        return rsvps.find((r) => r.player_id === playerId);
      }

      return rsvps.find((r) => r.user_id === user.id && !r.player_id);
    },
    [user]
  );

  /**
   * Record attendance for an event
   */
  const recordAttendance = useCallback(
    async (
      eventId: string,
      records: Array<{
        userId?: string;
        playerId?: string;
        status: AttendanceStatus;
        notes?: string;
      }>
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Delete existing records for this event
      const userIds = records.filter((r) => r.userId).map((r) => r.userId);
      const playerIds = records.filter((r) => r.playerId).map((r) => r.playerId);

      if (userIds.length > 0) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('event_id', eventId)
          .in('user_id', userIds);
      }

      if (playerIds.length > 0) {
        await supabase
          .from('attendance_records')
          .delete()
          .eq('event_id', eventId)
          .in('player_id', playerIds);
      }

      // Insert new records
      const insertRecords = records.map((r) => ({
        event_id: eventId,
        user_id: r.userId || null,
        player_id: r.playerId || null,
        status: r.status,
        notes: r.notes || null,
        recorded_by: user.id,
      }));

      const { error } = await supabase.from('attendance_records').insert(insertRecords);

      if (error) {
        console.error('Error recording attendance:', error);
        return { success: false, error: 'Failed to record attendance' };
      }

      return { success: true };
    },
    [user, supabase]
  );

  /**
   * Get attendance statistics for the team
   */
  const getAttendanceStats = useCallback(
    async (options?: {
      startDate?: string;
      endDate?: string;
      eventType?: EventType;
    }): Promise<{
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
    }> => {
      if (!currentTeam) {
        return { byPlayer: [], byEvent: [], overall: { totalEvents: 0, averageAttendance: 0 } };
      }

      // Get events with attendance
      let query = supabase
        .from('events')
        .select(`
          id,
          title,
          start_time,
          type,
          attendance_records(*, player:players!player_id(*))
        `)
        .eq('team_id', currentTeam.id)
        .order('start_time', { ascending: false });

      if (options?.eventType) {
        query = query.eq('type', options.eventType);
      }

      if (options?.startDate) {
        query = query.gte('start_time', options.startDate);
      }

      if (options?.endDate) {
        query = query.lte('start_time', options.endDate);
      }

      const { data: events } = await query;

      if (!events || events.length === 0) {
        return { byPlayer: [], byEvent: [], overall: { totalEvents: 0, averageAttendance: 0 } };
      }

      // Get all players
      const { data: players } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .eq('team_id', currentTeam.id)
        .eq('status', 'active');

      // Calculate stats by player
      const playerStats = new Map<
        string,
        { name: string; total: number; present: number; absent: number; late: number; excused: number }
      >();

      players?.forEach((player) => {
        playerStats.set(player.id, {
          name: `${player.first_name} ${player.last_name}`,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        });
      });

      // Calculate stats by event
      const eventStats: Array<{
        eventId: string;
        eventTitle: string;
        eventDate: string;
        total: number;
        present: number;
        absent: number;
      }> = [];

      let totalPresent = 0;
      let totalRecords = 0;

      events.forEach((event: any) => {
        const records = event.attendance_records || [];
        let eventPresent = 0;
        let eventAbsent = 0;

        records.forEach((record: any) => {
          if (record.player_id && playerStats.has(record.player_id)) {
            const stats = playerStats.get(record.player_id)!;
            stats.total++;

            switch (record.status) {
              case 'present':
                stats.present++;
                eventPresent++;
                totalPresent++;
                break;
              case 'absent':
                stats.absent++;
                eventAbsent++;
                break;
              case 'late':
                stats.late++;
                eventPresent++; // Late still counts as attended
                totalPresent++;
                break;
              case 'excused':
                stats.excused++;
                break;
            }
            totalRecords++;
          }
        });

        eventStats.push({
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.start_time,
          total: records.length,
          present: eventPresent,
          absent: eventAbsent,
        });
      });

      // Convert player stats to array with rates
      const byPlayer = Array.from(playerStats.entries()).map(([playerId, stats]) => ({
        playerId,
        playerName: stats.name,
        ...stats,
        rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      }));

      return {
        byPlayer: byPlayer.sort((a, b) => b.rate - a.rate),
        byEvent: eventStats,
        overall: {
          totalEvents: events.length,
          averageAttendance: totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0,
        },
      };
    },
    [currentTeam, supabase]
  );

  /**
   * Link a session plan to an event
   */
  const linkSession = useCallback(
    async (
      eventId: string,
      sessionId: string | null
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('events')
        .update({ session_id: sessionId })
        .eq('id', eventId);

      if (error) {
        console.error('Error linking session:', error);
        return { success: false, error: 'Failed to link session' };
      }

      return { success: true };
    },
    [supabase]
  );

  return {
    isLoading,
    getEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    submitRsvp,
    getRsvpCounts,
    getUserRsvp,
    recordAttendance,
    getAttendanceStats,
    linkSession,
  };
}
