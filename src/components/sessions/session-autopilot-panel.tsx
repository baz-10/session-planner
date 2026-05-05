'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Sparkles,
  UserMinus,
  UserRoundX,
  Users,
} from 'lucide-react';
import { useAISettings } from '@/hooks/use-ai-settings';
import { MobileListCard, MobileSegmentedControl } from '@/components/mobile';
import type {
  SessionAutopilotRequest,
  SessionAutopilotResponse,
  SessionAutopilotVariant,
  TurnoutScenario,
} from '@/lib/ai/session-autopilot-types';

interface SessionAutopilotPanelProps {
  teamId?: string;
  sessionContext: {
    sessionName?: string;
    durationMinutes?: number;
    offensiveEmphasis?: string | null;
    defensiveEmphasis?: string | null;
    existingActivities: Array<{ name: string; duration: number }>;
  };
  disabled?: boolean;
  onApplyVariant: (variant: SessionAutopilotVariant) => Promise<void>;
}

const scenarioOptions: Array<{ value: TurnoutScenario; label: string; description: string }> = [
  { value: 'full', label: 'Full Team', description: 'Built for normal/full attendance' },
  { value: 'short', label: 'Short Bench', description: 'Built for moderate attendance drop' },
  { value: 'low', label: 'Low Attendance', description: 'Built for very small groups' },
];

export function SessionAutopilotPanel({
  teamId,
  sessionContext,
  disabled = false,
  onApplyVariant,
}: SessionAutopilotPanelProps) {
  const { settings, hasApiKey } = useAISettings();

  const [primaryScenario, setPrimaryScenario] = useState<TurnoutScenario>('full');
  const [includeAiNotes, setIncludeAiNotes] = useState(false);
  const [variants, setVariants] = useState<SessionAutopilotVariant[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingKey, setIsApplyingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUseAiNotes = hasApiKey && settings.aiEnabled;

  useEffect(() => {
    if (!canUseAiNotes) {
      setIncludeAiNotes(false);
      return;
    }

    setIncludeAiNotes(true);
  }, [canUseAiNotes]);

  const totalExistingMinutes = useMemo(
    () => sessionContext.existingActivities.reduce((sum, activity) => sum + activity.duration, 0),
    [sessionContext.existingActivities]
  );

  const handleGenerate = useCallback(async () => {
    if (!teamId) {
      setError('Select a team before using autopilot.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const payload: SessionAutopilotRequest = {
        teamId,
        apiKey: includeAiNotes ? settings.openaiApiKey : null,
        options: {
          primaryScenario,
          includeAiNotes,
        },
        sessionContext: {
          sessionName: sessionContext.sessionName,
          durationMinutes: sessionContext.durationMinutes,
          offensiveEmphasis: sessionContext.offensiveEmphasis,
          defensiveEmphasis: sessionContext.defensiveEmphasis,
          existingActivities: sessionContext.existingActivities,
        },
      };

      const response = await fetch('/api/ai/session-autopilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as SessionAutopilotResponse;

      if (!response.ok || !result.success || !result.variants) {
        setVariants([]);
        setWarnings([]);
        setError(result.error || 'Failed to generate autopilot plans.');
        return;
      }

      setVariants(result.variants);
      setWarnings(result.warnings || []);
    } catch (requestError) {
      console.error('Session autopilot request failed:', requestError);
      setVariants([]);
      setWarnings([]);
      setError('Failed to generate plans. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [
    includeAiNotes,
    primaryScenario,
    sessionContext,
    settings.openaiApiKey,
    teamId,
  ]);

  const handleApply = useCallback(
    async (variant: SessionAutopilotVariant) => {
      setIsApplyingKey(variant.key);
      setError(null);

      try {
        await onApplyVariant(variant);
      } catch (applyError) {
        console.error('Applying autopilot plan failed:', applyError);
        setError(applyError instanceof Error ? applyError.message : 'Failed to apply generated plan.');
      } finally {
        setIsApplyingKey(null);
      }
    },
    [onApplyVariant]
  );

  const selectedScenario = scenarioOptions.find((option) => option.value === primaryScenario);

  return (
    <section className="space-y-4">
      <MobileListCard className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-normal text-teal">
              <Sparkles className="h-4 w-4" />
              Session Autopilot
            </div>
            <h2 className="mt-1 text-2xl font-extrabold text-navy">Build Plan A/B/C</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Uses your session focus, existing plan, and attendance context where available.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={disabled || isGenerating || !teamId}
            className="min-h-12 shrink-0 rounded-2xl bg-navy px-4 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {isGenerating ? 'Generating' : 'Generate'}
          </button>
        </div>

        <div>
          <div className="mb-2 text-sm font-extrabold text-navy">Primary Scenario</div>
          <MobileSegmentedControl<TurnoutScenario>
            value={primaryScenario}
            onChange={setPrimaryScenario}
            disabled={disabled || isGenerating}
            options={[
              { value: 'full', label: 'Full Team', icon: <Users className="h-4 w-4" /> },
              { value: 'short', label: 'Short Bench', icon: <UserMinus className="h-4 w-4" /> },
              { value: 'low', label: 'Low Attendance', icon: <UserRoundX className="h-4 w-4" /> },
            ]}
          />
          <p className="mt-2 text-sm font-medium text-slate-500">
            {selectedScenario?.description}
          </p>
        </div>

        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
          <span className="text-sm font-bold text-slate-600">Add AI coaching cues</span>
          <input
            type="checkbox"
            checked={includeAiNotes}
            onChange={(event) => setIncludeAiNotes(event.target.checked)}
            disabled={disabled || isGenerating || !canUseAiNotes}
            className="h-5 w-5 accent-accent"
          />
        </label>
        {!canUseAiNotes && (
          <p className="text-xs font-medium text-slate-500">
            Enable AI and add an API key in Settings to include generated coaching notes.
          </p>
        )}
      </MobileListCard>

      <div className="grid gap-4 md:grid-cols-2">
        <MobileListCard className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-teal text-white">
            <BarChart3 className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-navy">Current Snapshot</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {sessionContext.existingActivities.length} activities
            </p>
            <p className="text-sm font-semibold text-slate-500">
              {totalExistingMinutes} minutes allocated
            </p>
          </div>
        </MobileListCard>

        <MobileListCard
          className={
            warnings.length > 0
              ? 'border-amber-200 bg-amber-50'
              : 'border-slate-200 bg-white'
          }
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className={warnings.length > 0 ? 'h-5 w-5 text-amber-600' : 'h-5 w-5 text-slate-400'} />
            <h3 className="text-lg font-extrabold text-navy">Warnings</h3>
          </div>
          {warnings.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {warnings.map((warning) => (
                <li key={warning} className="flex gap-2 text-sm font-medium leading-5 text-amber-900">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  {warning}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm font-medium text-slate-500">
              Generate plans to surface attendance and balance warnings.
            </p>
          )}
        </MobileListCard>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {variants.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {variants.map((variant) => (
            <MobileListCard key={variant.key} className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-navy text-3xl font-extrabold text-teal-light">
                  {variant.key}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-extrabold text-navy">{variant.label}</h3>
                    {variant.key === 'A' && (
                      <span className="rounded-full border border-accent/20 bg-teal-glow px-2.5 py-1 text-xs font-extrabold text-teal-dark">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                    {variant.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-slate-500">
                    <span>{variant.expectedPlayers} players</span>
                    <span>{variant.totalMinutes} min total</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {variant.activities.slice(0, 3).map((activity, index) => (
                  <div
                    key={`${variant.key}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="text-sm font-extrabold leading-5 text-navy">
                      {activity.name}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {activity.duration} min
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleApply(variant)}
                disabled={disabled || isApplyingKey !== null}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-teal bg-white text-base font-extrabold text-teal disabled:opacity-50"
              >
                {isApplyingKey === variant.key ? (
                  'Applying'
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Apply {variant.label}
                  </>
                )}
              </button>
            </MobileListCard>
          ))}
        </div>
      ) : (
        <MobileListCard className="text-center">
          <p className="text-sm font-semibold text-slate-500">
            No generated plans yet. Pick the expected turnout scenario, then generate Plan A/B/C.
          </p>
        </MobileListCard>
      )}
    </section>
  );
}
