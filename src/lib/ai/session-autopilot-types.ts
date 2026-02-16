export type TurnoutScenario = 'full' | 'short' | 'low';
export type SessionVariantKey = 'A' | 'B' | 'C';

export interface SessionAutopilotRequest {
  teamId: string;
  apiKey?: string | null;
  options: {
    primaryScenario: TurnoutScenario;
    includeAiNotes?: boolean;
  };
  sessionContext: {
    sessionName?: string;
    durationMinutes?: number;
    offensiveEmphasis?: string | null;
    defensiveEmphasis?: string | null;
    existingActivities?: Array<{
      name: string;
      duration: number;
    }>;
  };
}

export interface SessionAutopilotActivity {
  name: string;
  duration: number;
  drillId?: string;
  categoryId?: string;
  categoryName?: string;
  notes?: string;
}

export interface SessionAutopilotVariant {
  key: SessionVariantKey;
  label: string;
  scenario: TurnoutScenario;
  expectedPlayers: number;
  totalMinutes: number;
  summary: string;
  constraintsApplied: string[];
  activities: SessionAutopilotActivity[];
}

export interface SessionAutopilotResponse {
  success: boolean;
  error?: string;
  generatedAt?: string;
  metadata?: {
    activePlayers: number;
    attendanceRate: number;
    upcomingRsvpRate: number | null;
    librarySize: number;
  };
  warnings?: string[];
  variants?: SessionAutopilotVariant[];
}

export interface SessionAutopilotDrillInput {
  id: string;
  name: string;
  description: string | null;
  defaultDuration: number;
  categoryId: string | null;
  categoryName: string | null;
}

export interface SessionAutopilotBuildInput {
  teamName: string;
  sport: string;
  activePlayers: number;
  attendanceRate: number;
  upcomingRsvpRate: number | null;
  drills: SessionAutopilotDrillInput[];
  recentActivityNames: string[];
  recentDrillIds: string[];
  request: SessionAutopilotRequest;
}
