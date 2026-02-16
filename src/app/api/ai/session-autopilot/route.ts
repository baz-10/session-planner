import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { buildSessionAutopilotPlan } from '@/lib/ai/session-autopilot-service';
import type {
  SessionAutopilotBuildInput,
  SessionAutopilotRequest,
  SessionAutopilotDrillInput,
} from '@/lib/ai/session-autopilot-types';

const COACH_ROLES = new Set(['admin', 'coach']);
const DEFAULT_ATTENDANCE_RATE = 82;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SessionAutopilotRequest;

    if (!body?.teamId) {
      return NextResponse.json(
        { success: false, error: 'teamId is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', body.teamId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership || !COACH_ROLES.has(membership.role)) {
      return NextResponse.json(
        { success: false, error: 'Only coaches or admins can use session autopilot.' },
        { status: 403 }
      );
    }

    const [teamResult, drillsResult, sessionsResult, attendanceResult, upcomingResult, playersResult, rosterPlayersResult] =
      await Promise.all([
        supabase
          .from('teams')
          .select('id, name, sport')
          .eq('id', body.teamId)
          .single(),
        supabase
          .from('drills')
          .select('id, name, description, default_duration, category_id, category:drill_categories(name)')
          .eq('team_id', body.teamId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('sessions')
          .select('id')
          .eq('team_id', body.teamId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('events')
          .select('id, start_time, attendance_records(status)')
          .eq('team_id', body.teamId)
          .gte('start_time', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
          .order('start_time', { ascending: false })
          .limit(25),
        supabase
          .from('events')
          .select('id, start_time, rsvps(status)')
          .eq('team_id', body.teamId)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('players')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', body.teamId)
          .eq('status', 'active'),
        supabase
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', body.teamId)
          .eq('role', 'player')
          .neq('status', 'inactive'),
      ]);

    if (teamResult.error || !teamResult.data) {
      return NextResponse.json(
        { success: false, error: 'Unable to load team context for autopilot.' },
        { status: 400 }
      );
    }

    if (drillsResult.error) {
      return NextResponse.json(
        { success: false, error: 'Unable to load drill library.' },
        { status: 400 }
      );
    }

    const recentSessionIds = (sessionsResult.data || []).map((session: { id: string }) => session.id);

    let recentActivityData: Array<{ drill_id: string | null; name: string }> = [];
    if (recentSessionIds.length > 0) {
      const recentActivitiesResult = await supabase
        .from('session_activities')
        .select('drill_id, name')
        .in('session_id', recentSessionIds)
        .order('updated_at', { ascending: false })
        .limit(80);

      if (!recentActivitiesResult.error) {
        recentActivityData = (recentActivitiesResult.data || []) as Array<{
          drill_id: string | null;
          name: string;
        }>;
      }
    }

    const attendanceRate = computeAttendanceRate(
      (attendanceResult.data || []) as Array<{ attendance_records?: Array<{ status: string }> }>
    );

    const upcomingRsvpRate = computeUpcomingRsvpRate(
      (upcomingResult.data as { rsvps?: Array<{ status: string }> } | null) || null
    );

    const activePlayers = Math.max(playersResult.count || 0, rosterPlayersResult.count || 0, 8);

    const drills: SessionAutopilotDrillInput[] = (drillsResult.data || []).map((drill: any) => ({
      id: drill.id,
      name: drill.name,
      description: drill.description || null,
      defaultDuration: drill.default_duration || 10,
      categoryId: drill.category_id || null,
      categoryName: drill.category?.name || null,
    }));

    const buildInput: SessionAutopilotBuildInput = {
      teamName: teamResult.data.name,
      sport: teamResult.data.sport || 'basketball',
      activePlayers,
      attendanceRate: attendanceRate ?? DEFAULT_ATTENDANCE_RATE,
      upcomingRsvpRate,
      drills,
      recentActivityNames: recentActivityData.map((item) => item.name).filter(Boolean),
      recentDrillIds: recentActivityData
        .map((item) => item.drill_id)
        .filter((drillId): drillId is string => Boolean(drillId)),
      request: {
        teamId: body.teamId,
        apiKey: body.apiKey,
        options: {
          primaryScenario: body.options?.primaryScenario || 'full',
          includeAiNotes: Boolean(body.options?.includeAiNotes),
        },
        sessionContext: {
          sessionName: body.sessionContext?.sessionName,
          durationMinutes: body.sessionContext?.durationMinutes,
          offensiveEmphasis: body.sessionContext?.offensiveEmphasis,
          defensiveEmphasis: body.sessionContext?.defensiveEmphasis,
          existingActivities: body.sessionContext?.existingActivities || [],
        },
      },
    };

    const result = await buildSessionAutopilotPlan(buildInput);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Session Autopilot API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function computeAttendanceRate(
  events: Array<{ attendance_records?: Array<{ status: string }> }>
): number | null {
  let total = 0;
  let present = 0;

  events.forEach((event) => {
    (event.attendance_records || []).forEach((record) => {
      total += 1;
      if (record.status === 'present' || record.status === 'late') {
        present += 1;
      }
    });
  });

  if (total === 0) {
    return null;
  }

  return Math.round((present / total) * 1000) / 10;
}

function computeUpcomingRsvpRate(
  upcomingEvent: { rsvps?: Array<{ status: string }> } | null
): number | null {
  if (!upcomingEvent || !Array.isArray(upcomingEvent.rsvps) || upcomingEvent.rsvps.length === 0) {
    return null;
  }

  const total = upcomingEvent.rsvps.length;
  const weightedGoing = upcomingEvent.rsvps.reduce((sum, rsvp) => {
    if (rsvp.status === 'going') {
      return sum + 1;
    }
    if (rsvp.status === 'maybe') {
      return sum + 0.5;
    }
    return sum;
  }, 0);

  return Math.round((weightedGoing / total) * 1000) / 10;
}
