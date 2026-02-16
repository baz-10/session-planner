import type {
  SessionAutopilotActivity,
  SessionAutopilotBuildInput,
  SessionAutopilotResponse,
  SessionAutopilotVariant,
  SessionVariantKey,
  TurnoutScenario,
} from './session-autopilot-types';

type DrillBucket = 'warmup' | 'skill' | 'team' | 'conditioning' | 'cooldown' | 'generic';

interface PreparedDrill {
  id: string;
  name: string;
  description: string | null;
  defaultDuration: number;
  categoryId: string | null;
  categoryName: string | null;
  bucket: DrillBucket;
  searchText: string;
}

interface BlockTemplate {
  bucket: DrillBucket;
  label: string;
  weight: number;
}

interface VariantBuildResult {
  variant: SessionAutopilotVariant;
  usedFallback: number;
}

const SCENARIO_LABELS: Record<TurnoutScenario, string> = {
  full: 'Full Team',
  short: 'Short Bench',
  low: 'Low Attendance',
};

const SCENARIO_MULTIPLIERS: Record<TurnoutScenario, number> = {
  full: 1,
  short: 0.75,
  low: 0.55,
};

const OFFENSE_KEYWORDS = ['offense', 'attacking', 'spacing', 'passing', 'shooting', 'finishing'];
const DEFENSE_KEYWORDS = ['defense', 'closeout', 'contain', 'rebound', 'pressure', 'help'];

export async function buildSessionAutopilotPlan(
  input: SessionAutopilotBuildInput
): Promise<SessionAutopilotResponse> {
  if (input.drills.length === 0) {
    return {
      success: false,
      error: 'No drills found for this team. Add drills to your library before using autopilot.',
    };
  }

  const durationMinutes = clampMinutes(input.request.sessionContext.durationMinutes ?? 90);
  const scenarioOrder = buildScenarioOrder(input.request.options.primaryScenario);
  const preparedDrills = input.drills.map((drill) => prepareDrill(drill));
  const recentActivityNames = new Set(input.recentActivityNames.map(normalizeText));
  const recentDrillIds = new Set(input.recentDrillIds);
  const existingActivityNames = new Set(
    (input.request.sessionContext.existingActivities || []).map((activity) => normalizeText(activity.name))
  );

  const warnings: string[] = [];
  if (preparedDrills.length < 12) {
    warnings.push(
      `Drill library is small (${preparedDrills.length} drills). Add more drills for stronger variety.`
    );
  }

  const variantsWithFallbackUsage = scenarioOrder.map((scenario, index) =>
    buildVariant({
      key: (['A', 'B', 'C'] as SessionVariantKey[])[index],
      scenario,
      durationMinutes,
      input,
      preparedDrills,
      recentActivityNames,
      recentDrillIds,
      existingActivityNames,
    })
  );

  const totalFallbackActivities = variantsWithFallbackUsage.reduce(
    (sum, item) => sum + item.usedFallback,
    0
  );

  if (totalFallbackActivities > 0) {
    warnings.push(
      `Used ${totalFallbackActivities} fallback activities where the drill library had no close match.`
    );
  }

  let variants = variantsWithFallbackUsage.map((item) => item.variant);

  const includeAiNotes = Boolean(
    input.request.options.includeAiNotes && input.request.apiKey && input.request.apiKey.trim()
  );

  if (includeAiNotes) {
    try {
      variants = await enrichWithAiCoachingNotes(variants, input);
    } catch (error) {
      console.error('Session autopilot AI note enrichment failed:', error);
      warnings.push('AI coaching note generation failed. Generated plans still use deterministic notes.');
    }
  }

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    metadata: {
      activePlayers: input.activePlayers,
      attendanceRate: roundToOne(input.attendanceRate),
      upcomingRsvpRate:
        input.upcomingRsvpRate === null ? null : roundToOne(input.upcomingRsvpRate),
      librarySize: input.drills.length,
    },
    warnings,
    variants,
  };
}

function buildVariant(params: {
  key: SessionVariantKey;
  scenario: TurnoutScenario;
  durationMinutes: number;
  input: SessionAutopilotBuildInput;
  preparedDrills: PreparedDrill[];
  recentActivityNames: Set<string>;
  recentDrillIds: Set<string>;
  existingActivityNames: Set<string>;
}): VariantBuildResult {
  const {
    key,
    scenario,
    durationMinutes,
    input,
    preparedDrills,
    recentActivityNames,
    recentDrillIds,
    existingActivityNames,
  } = params;

  const blocks = getBlocksForScenario(scenario);
  const blockDurations = allocateBlockDurations(durationMinutes, blocks.map((block) => block.weight));

  const usedDrillIds = new Set<string>();
  const activities: SessionAutopilotActivity[] = [];
  let usedFallback = 0;

  blocks.forEach((block, index) => {
    const blockMinutes = blockDurations[index];
    const candidate = selectBestDrill({
      drills: preparedDrills,
      block,
      blockMinutes,
      scenario,
      usedDrillIds,
      recentActivityNames,
      recentDrillIds,
      existingActivityNames,
      offensiveEmphasis: input.request.sessionContext.offensiveEmphasis,
      defensiveEmphasis: input.request.sessionContext.defensiveEmphasis,
      activityIndex: index,
    });

    if (candidate) {
      usedDrillIds.add(candidate.id);
      activities.push({
        name: candidate.name,
        duration: blockMinutes,
        drillId: candidate.id,
        categoryId: candidate.categoryId || undefined,
        categoryName: candidate.categoryName || labelForBucket(candidate.bucket),
        notes: buildDeterministicNote(candidate, scenario, blockMinutes),
      });
      return;
    }

    usedFallback += 1;
    activities.push({
      name: fallbackNameForBucket(block.bucket),
      duration: blockMinutes,
      categoryName: labelForBucket(block.bucket),
      notes: fallbackNoteForBucket(block.bucket, scenario),
    });
  });

  const expectedPlayers = estimateExpectedPlayers(
    input.activePlayers,
    input.attendanceRate,
    input.upcomingRsvpRate,
    scenario
  );

  const constraintsApplied = [
    'Balanced minute split across warmup, skill, team, conditioning, and cooldown phases.',
    'Penalized drills recently used in prior sessions to increase variety.',
    scenarioConstraintLabel(scenario),
  ];

  const summaryParts = [
    `${SCENARIO_LABELS[scenario]} plan for ~${expectedPlayers} players`,
    focusSummary(input.request.sessionContext.offensiveEmphasis, input.request.sessionContext.defensiveEmphasis),
    `${durationMinutes} total minutes`,
  ].filter(Boolean);

  return {
    usedFallback,
    variant: {
      key,
      label: `Plan ${key} · ${SCENARIO_LABELS[scenario]}`,
      scenario,
      expectedPlayers,
      totalMinutes: activities.reduce((sum, activity) => sum + activity.duration, 0),
      summary: summaryParts.join(' | '),
      constraintsApplied,
      activities,
    },
  };
}

function getBlocksForScenario(scenario: TurnoutScenario): BlockTemplate[] {
  if (scenario === 'full') {
    return [
      { bucket: 'warmup', label: 'Dynamic Warmup', weight: 0.14 },
      { bucket: 'skill', label: 'Skill Block 1', weight: 0.2 },
      { bucket: 'team', label: 'Team Block 1', weight: 0.22 },
      { bucket: 'skill', label: 'Skill Block 2', weight: 0.18 },
      { bucket: 'team', label: 'Team Block 2', weight: 0.16 },
      { bucket: 'conditioning', label: 'Conditioning', weight: 0.1 },
    ];
  }

  if (scenario === 'short') {
    return [
      { bucket: 'warmup', label: 'Dynamic Warmup', weight: 0.15 },
      { bucket: 'skill', label: 'Skill Block 1', weight: 0.24 },
      { bucket: 'team', label: 'Small Team Concepts', weight: 0.18 },
      { bucket: 'skill', label: 'Skill Block 2', weight: 0.21 },
      { bucket: 'conditioning', label: 'Conditioning', weight: 0.14 },
      { bucket: 'cooldown', label: 'Cooldown', weight: 0.08 },
    ];
  }

  return [
    { bucket: 'warmup', label: 'Dynamic Warmup', weight: 0.15 },
    { bucket: 'skill', label: 'Skill Block 1', weight: 0.28 },
    { bucket: 'skill', label: 'Skill Block 2', weight: 0.24 },
    { bucket: 'conditioning', label: 'Conditioning', weight: 0.15 },
    { bucket: 'team', label: 'Compact Team Segment', weight: 0.1 },
    { bucket: 'cooldown', label: 'Cooldown', weight: 0.08 },
  ];
}

function allocateBlockDurations(totalMinutes: number, weights: number[]): number[] {
  if (weights.length === 0) {
    return [];
  }

  const minPerBlock = totalMinutes >= 72 ? 8 : 6;
  const base = new Array(weights.length).fill(minPerBlock);
  const guaranteed = minPerBlock * weights.length;

  if (guaranteed > totalMinutes) {
    return divideEvenly(totalMinutes, weights.length, 4);
  }

  let remaining = totalMinutes - guaranteed;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const fractional: Array<{ index: number; fraction: number }> = [];

  for (let i = 0; i < weights.length; i += 1) {
    const share = totalWeight > 0 ? (weights[i] / totalWeight) * remaining : 0;
    const whole = Math.floor(share);
    base[i] += whole;
    fractional.push({ index: i, fraction: share - whole });
  }

  const used = base.reduce((sum, minutes) => sum + minutes, 0);
  remaining = totalMinutes - used;

  fractional
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, Math.max(0, remaining))
    .forEach(({ index }) => {
      base[index] += 1;
    });

  return base;
}

function divideEvenly(total: number, parts: number, minFloor: number): number[] {
  if (parts <= 0) {
    return [];
  }

  const even = Math.floor(total / parts);
  const base = new Array(parts).fill(Math.max(minFloor, even));
  let sum = base.reduce((acc, value) => acc + value, 0);

  while (sum > total) {
    const index = base.findIndex((value) => value > minFloor);
    if (index === -1) {
      break;
    }
    base[index] -= 1;
    sum -= 1;
  }

  while (sum < total) {
    const index = sum % parts;
    base[index] += 1;
    sum += 1;
  }

  return base;
}

function prepareDrill(drill: SessionAutopilotBuildInput['drills'][number]): PreparedDrill {
  const searchText = normalizeText(`${drill.name} ${drill.description || ''} ${drill.categoryName || ''}`);

  return {
    id: drill.id,
    name: drill.name,
    description: drill.description,
    defaultDuration: clampMinutes(drill.defaultDuration || 10),
    categoryId: drill.categoryId,
    categoryName: drill.categoryName,
    bucket: bucketForText(searchText),
    searchText,
  };
}

function selectBestDrill(params: {
  drills: PreparedDrill[];
  block: BlockTemplate;
  blockMinutes: number;
  scenario: TurnoutScenario;
  usedDrillIds: Set<string>;
  recentActivityNames: Set<string>;
  recentDrillIds: Set<string>;
  existingActivityNames: Set<string>;
  offensiveEmphasis?: string | null;
  defensiveEmphasis?: string | null;
  activityIndex: number;
}): PreparedDrill | null {
  const {
    drills,
    block,
    blockMinutes,
    scenario,
    usedDrillIds,
    recentActivityNames,
    recentDrillIds,
    existingActivityNames,
    offensiveEmphasis,
    defensiveEmphasis,
    activityIndex,
  } = params;

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestDrill: PreparedDrill | null = null;

  drills.forEach((drill) => {
    if (usedDrillIds.has(drill.id)) {
      return;
    }

    let score = 50;

    if (drill.bucket === block.bucket) {
      score += 45;
    } else if (block.bucket === 'team' && drill.bucket === 'skill') {
      score += 8;
    } else if (block.bucket === 'skill' && drill.bucket === 'team') {
      score += 5;
    } else if (drill.bucket === 'generic') {
      score += 3;
    }

    score -= Math.abs(drill.defaultDuration - blockMinutes) * 2;

    if (recentDrillIds.has(drill.id)) {
      score -= 24;
    }

    const normalizedName = normalizeText(drill.name);
    if (recentActivityNames.has(normalizedName)) {
      score -= 18;
    }

    if (existingActivityNames.has(normalizedName)) {
      score -= 16;
    }

    if (scenario !== 'full' && isLargeGroupDrill(drill.searchText)) {
      score -= scenario === 'short' ? 16 : 28;
    }

    if (offensiveEmphasis && includesKeywordMatch(drill.searchText, offensiveEmphasis, OFFENSE_KEYWORDS)) {
      score += 10;
    }

    if (defensiveEmphasis && includesKeywordMatch(drill.searchText, defensiveEmphasis, DEFENSE_KEYWORDS)) {
      score += 10;
    }

    score += deterministicJitter(`${drill.id}:${activityIndex}`);

    if (score > bestScore) {
      bestScore = score;
      bestDrill = drill;
    }
  });

  return bestScore > -20 ? bestDrill : null;
}

function buildDeterministicNote(
  drill: PreparedDrill,
  scenario: TurnoutScenario,
  durationMinutes: number
): string {
  const scenarioCue =
    scenario === 'full'
      ? 'Run this at full-team pace and demand vocal communication.'
      : scenario === 'short'
      ? 'Use two stations and keep reps tight to handle a short bench.'
      : 'Run compact groups with quick turnovers to maximize touches.';

  const baseDescription =
    drill.description?.trim() ||
    'Focus on quality reps, short feedback loops, and clean transitions between groups.';

  return `${baseDescription} ${scenarioCue} Keep this block to ${durationMinutes} minutes.`;
}

function fallbackNameForBucket(bucket: DrillBucket): string {
  switch (bucket) {
    case 'warmup':
      return 'Dynamic Warmup Circuit';
    case 'skill':
      return 'Fundamentals Repetition Block';
    case 'team':
      return 'Team Concept Walkthrough';
    case 'conditioning':
      return 'Conditioning Ladder';
    case 'cooldown':
      return 'Cooldown + Team Debrief';
    default:
      return 'Coach-Directed Activity';
  }
}

function fallbackNoteForBucket(bucket: DrillBucket, scenario: TurnoutScenario): string {
  const shared =
    scenario === 'full'
      ? 'Use full-court spacing and assign captains to run transitions.'
      : scenario === 'short'
      ? 'Split into two balanced groups and shorten explanation windows.'
      : 'Use small-sided reps and rotate every 60-90 seconds.';

  switch (bucket) {
    case 'warmup':
      return `Build temperature and movement quality first. ${shared}`;
    case 'skill':
      return `Repeat core technical actions at game speed. ${shared}`;
    case 'team':
      return `Install one team principle and reinforce through repetition. ${shared}`;
    case 'conditioning':
      return `Drive pace while maintaining execution discipline. ${shared}`;
    case 'cooldown':
      return `Decompress, stretch, and review top coaching points. ${shared}`;
    default:
      return shared;
  }
}

function scenarioConstraintLabel(scenario: TurnoutScenario): string {
  if (scenario === 'full') {
    return 'Optimized for full-team reps and larger group actions.';
  }
  if (scenario === 'short') {
    return 'Optimized for short-bench attendance with higher station efficiency.';
  }
  return 'Optimized for low attendance with compact small-sided structure.';
}

function estimateExpectedPlayers(
  activePlayers: number,
  attendanceRate: number,
  upcomingRsvpRate: number | null,
  scenario: TurnoutScenario
): number {
  if (activePlayers <= 0) {
    return 0;
  }

  const attendanceFactor = clampToRange(attendanceRate / 100, 0.45, 1);
  const rsvpFactor =
    upcomingRsvpRate === null ? attendanceFactor : clampToRange(upcomingRsvpRate / 100, 0.4, 1);
  const multiplier = SCENARIO_MULTIPLIERS[scenario];

  return Math.max(4, Math.min(activePlayers, Math.round(activePlayers * rsvpFactor * multiplier)));
}

function focusSummary(offensive?: string | null, defensive?: string | null): string {
  if (offensive && defensive) {
    return `Focus: offense (${offensive}) + defense (${defensive})`;
  }
  if (offensive) {
    return `Focus: offense (${offensive})`;
  }
  if (defensive) {
    return `Focus: defense (${defensive})`;
  }
  return 'Focus: balanced team development';
}

function buildScenarioOrder(primaryScenario: TurnoutScenario): TurnoutScenario[] {
  const all: TurnoutScenario[] = ['full', 'short', 'low'];
  return [primaryScenario, ...all.filter((scenario) => scenario !== primaryScenario)];
}

function labelForBucket(bucket: DrillBucket): string {
  switch (bucket) {
    case 'warmup':
      return 'Warmup';
    case 'skill':
      return 'Skill';
    case 'team':
      return 'Team';
    case 'conditioning':
      return 'Conditioning';
    case 'cooldown':
      return 'Cooldown';
    default:
      return 'General';
  }
}

function bucketForText(searchText: string): DrillBucket {
  if (matchesAny(searchText, ['warm', 'activation', 'dynamic', 'mobility'])) {
    return 'warmup';
  }
  if (matchesAny(searchText, ['conditioning', 'sprint', 'fitness', 'cardio'])) {
    return 'conditioning';
  }
  if (matchesAny(searchText, ['cooldown', 'stretch', 'recovery', 'debrief'])) {
    return 'cooldown';
  }
  if (matchesAny(searchText, ['scrimmage', '5v5', '4v4', 'team', 'transition', 'set play'])) {
    return 'team';
  }
  if (
    matchesAny(searchText, [
      'shoot',
      'passing',
      'dribble',
      'ball handling',
      'finishing',
      'closeout',
      'footwork',
    ])
  ) {
    return 'skill';
  }
  return 'generic';
}

function isLargeGroupDrill(searchText: string): boolean {
  return matchesAny(searchText, ['scrimmage', '5v5', 'full court', 'team']) ||
    matchesAny(searchText, ['11v11', '7v7', 'set play']);
}

function includesKeywordMatch(searchText: string, emphasis: string, fallbackKeywords: string[]): boolean {
  const combined = `${searchText} ${normalizeText(emphasis)}`;
  const emphasisTokens = tokenize(emphasis);

  return (
    emphasisTokens.some((token) => token.length > 3 && searchText.includes(token)) ||
    fallbackKeywords.some((keyword) => combined.includes(keyword))
  );
}

function matchesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function deterministicJitter(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 7) - 3;
}

function clampMinutes(value: number): number {
  return Math.max(30, Math.min(180, Math.round(value)));
}

function clampToRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value).split(' ').filter(Boolean);
}

async function enrichWithAiCoachingNotes(
  variants: SessionAutopilotVariant[],
  input: SessionAutopilotBuildInput
): Promise<SessionAutopilotVariant[]> {
  const apiKey = input.request.apiKey?.trim();
  if (!apiKey) {
    return variants;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content:
            'You are a high-performance youth sports coach assistant. Return JSON only. Keep each note under 35 words and actionable.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            sport: input.sport,
            teamName: input.teamName,
            offensiveEmphasis: input.request.sessionContext.offensiveEmphasis,
            defensiveEmphasis: input.request.sessionContext.defensiveEmphasis,
            variants: variants.map((variant) => ({
              key: variant.key,
              scenario: variant.scenario,
              activities: variant.activities.map((activity, index) => ({
                index,
                name: activity.name,
                duration: activity.duration,
                category: activity.categoryName || 'General',
              })),
            })),
            responseShape: {
              variants: [
                {
                  key: 'A',
                  activityNotes: [
                    {
                      index: 0,
                      note: 'Short coaching cue for this activity',
                    },
                  ],
                },
              ],
            },
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI note request failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content as string | undefined;

  if (!content) {
    return variants;
  }

  const parsed = parseJsonObject(content);
  if (!parsed || typeof parsed !== 'object') {
    return variants;
  }

  const variantNotes = new Map<SessionVariantKey, Map<number, string>>();
  const parsedVariants = (parsed as { variants?: unknown }).variants;

  if (!Array.isArray(parsedVariants)) {
    return variants;
  }

  parsedVariants.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const key = (item as { key?: unknown }).key;
    if (key !== 'A' && key !== 'B' && key !== 'C') {
      return;
    }

    const activityNotes = (item as { activityNotes?: unknown }).activityNotes;
    if (!Array.isArray(activityNotes)) {
      return;
    }

    const noteMap = new Map<number, string>();

    activityNotes.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      const index = (entry as { index?: unknown }).index;
      const note = (entry as { note?: unknown }).note;

      if (typeof index === 'number' && Number.isInteger(index) && typeof note === 'string' && note.trim()) {
        noteMap.set(index, note.trim());
      }
    });

    if (noteMap.size > 0) {
      variantNotes.set(key, noteMap);
    }
  });

  return variants.map((variant) => {
    const notes = variantNotes.get(variant.key);
    if (!notes) {
      return variant;
    }

    return {
      ...variant,
      activities: variant.activities.map((activity, index) => {
        const aiNote = notes.get(index);
        if (!aiNote) {
          return activity;
        }

        return {
          ...activity,
          notes: activity.notes ? `${activity.notes} ${aiNote}` : aiNote,
        };
      }),
    };
  });
}

function parseJsonObject(content: string): unknown {
  const direct = safeJsonParse(content);
  if (direct) {
    return direct;
  }

  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    return null;
  }

  return safeJsonParse(objectMatch[0]);
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
