'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAISettings } from '@/hooks/use-ai-settings';
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

  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Attendance-Aware Session Autopilot</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Generates Plan A/B/C from your drill library, attendance trend, and session focus.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={disabled || isGenerating || !teamId}
            className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Plan A/B/C'}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
              Primary Scenario
            </label>
            <select
              value={primaryScenario}
              onChange={(event) => setPrimaryScenario(event.target.value as TurnoutScenario)}
              disabled={disabled || isGenerating}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {scenarioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {scenarioOptions.find((option) => option.value === primaryScenario)?.description}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
              AI Coaching Notes
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 border border-gray-300 rounded-md px-3 py-2">
              <input
                type="checkbox"
                checked={includeAiNotes}
                onChange={(event) => setIncludeAiNotes(event.target.checked)}
                disabled={disabled || isGenerating || !canUseAiNotes}
              />
              Add AI coaching cues
            </label>
            {!canUseAiNotes && (
              <p className="text-xs text-gray-500 mt-1">
                Enable AI + API key in Settings to use this.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
              Current Plan Snapshot
            </label>
            <div className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700">
              <div>{sessionContext.existingActivities.length} activities currently in plan</div>
              <div>{totalExistingMinutes} minutes currently allocated</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
            {warnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-800">
                {warning}
              </p>
            ))}
          </div>
        )}

        {variants.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {variants.map((variant) => (
              <article key={variant.key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{variant.label}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{variant.summary}</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                    {variant.totalMinutes} min
                  </span>
                </div>

                <div className="mt-3 text-xs text-gray-600 space-y-0.5">
                  <div>Expected players: {variant.expectedPlayers}</div>
                  <div>Activities: {variant.activities.length}</div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {variant.activities.slice(0, 4).map((activity, index) => (
                    <div key={`${variant.key}-${index}`} className="text-xs text-gray-700 flex items-start gap-2">
                      <span className="text-gray-500 min-w-[48px]">{activity.duration}m</span>
                      <span className="line-clamp-1">{activity.name}</span>
                    </div>
                  ))}
                  {variant.activities.length > 4 && (
                    <div className="text-xs text-gray-500">
                      +{variant.activities.length - 4} more activities
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleApply(variant)}
                  disabled={disabled || isApplyingKey !== null}
                  className="mt-4 w-full px-3 py-2 text-sm border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50"
                >
                  {isApplyingKey === variant.key ? 'Applying...' : `Apply ${variant.label}`}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
