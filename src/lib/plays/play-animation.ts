import type {
  AnimationTrigger,
  BasketballPlayDocument,
  PlayAction,
  PlayActionAnimation,
  PlayObject,
  PlayPhase,
  Point2D,
} from './diagram-types';

export const DEFAULT_ACTION_DURATION_MS = 900;
export const DEFAULT_SETTLE_DURATION_MS = 550;

type PositionMap = Record<string, Point2D>;

export interface ScheduledAction {
  index: number;
  action: PlayAction;
  trigger: AnimationTrigger;
  durationMs: number;
  startMs: number;
  endMs: number;
}

export interface PhaseTimeline {
  scheduledActions: ScheduledAction[];
  actionDurationMs: number;
  settleDurationMs: number;
  totalDurationMs: number;
}

export interface ActionWarning {
  actionId: string;
  message: string;
}

export interface CompiledTransition {
  phaseIndex: number;
  fromPhaseId: string;
  toPhaseId: string;
  startOwnerObjectId: string | null;
  endOwnerObjectId: string | null;
  timeline: PhaseTimeline;
  basePositions: PositionMap;
  postActionPositions: PositionMap;
  targetPositions: PositionMap;
  warnings: ActionWarning[];
}

export interface CompiledPlayback {
  transitions: CompiledTransition[];
  phaseStartOwners: Array<string | null>;
}

export interface TransitionFrame {
  positions: PositionMap;
  ballOwnerObjectId: string | null;
  actionProgress: number;
  settleProgress: number;
  isSettleSegment: boolean;
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isPlayerObject(object: PlayObject): boolean {
  return object.type === 'offense_player' || object.type === 'defense_player';
}

function isMovementAction(action: PlayAction): boolean {
  return action.type === 'dribble' || action.type === 'cut';
}

function isPossessionTransferAction(action: PlayAction): boolean {
  return action.type === 'pass' || action.type === 'handoff';
}

function normalizeSpeedMultiplier(speedMultiplier: number): number {
  return Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
}

function normalizeDuration(durationMs: number): number {
  if (!Number.isFinite(durationMs)) {
    return DEFAULT_ACTION_DURATION_MS;
  }
  return Math.max(120, Math.min(12000, Math.round(durationMs)));
}

function getActionAnimation(action: PlayAction): PlayActionAnimation {
  return {
    trigger: action.animation?.trigger || 'after_previous',
    durationMs: normalizeDuration(action.animation?.durationMs || DEFAULT_ACTION_DURATION_MS),
  };
}

function interpolatePoint(from: Point2D, to: Point2D, progress: number): Point2D {
  const t = clampProgress(progress);
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

function phasePositions(phase: PlayPhase): PositionMap {
  const map: PositionMap = {};
  for (const object of phase.objects) {
    map[object.id] = { ...object.position };
  }
  return map;
}

function inferOwnerFromLegacyBallMarker(phase: PlayPhase): string | null {
  const players = phase.objects.filter(isPlayerObject);
  if (players.length === 0) {
    return null;
  }

  const ballObject = phase.objects.find((object) => object.type === 'ball');
  if (!ballObject) {
    return null;
  }

  let closestPlayer = players[0];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const player of players) {
    const distance = Math.hypot(
      player.position.x - ballObject.position.x,
      player.position.y - ballObject.position.y
    );
    if (distance < closestDistance) {
      closestPlayer = player;
      closestDistance = distance;
    }
  }

  return closestPlayer?.id || null;
}

function getPhaseBallOwnerOverride(phase: PlayPhase): string | null | undefined {
  if (phase.ballOwnerObjectId === null) {
    return null;
  }

  if (typeof phase.ballOwnerObjectId !== 'string') {
    return undefined;
  }

  const player = phase.objects.find(
    (object) => object.id === phase.ballOwnerObjectId && isPlayerObject(object)
  );
  return player ? phase.ballOwnerObjectId : undefined;
}

export function resolveInitialBallOwner(phase: PlayPhase | undefined): string | null {
  if (!phase) {
    return null;
  }

  const override = getPhaseBallOwnerOverride(phase);
  if (override !== undefined) {
    return override;
  }

  const inferredFromLegacyMarker = inferOwnerFromLegacyBallMarker(phase);
  if (inferredFromLegacyMarker) {
    return inferredFromLegacyMarker;
  }

  const firstOffense = phase.objects.find((object) => object.type === 'offense_player');
  return firstOffense?.id || null;
}

export function getPhaseActionWarnings(phase: PlayPhase): ActionWarning[] {
  const warnings: ActionWarning[] = [];

  for (const action of phase.actions) {
    if (isPossessionTransferAction(action) && !action.toObjectId) {
      warnings.push({
        actionId: action.id,
        message: 'Pass/Handoff has no target player, so possession stays with current owner.',
      });
    }
  }

  return warnings;
}

export function compilePhaseTimeline(
  phase: PlayPhase,
  speedMultiplier = 1,
  settleDurationMs = DEFAULT_SETTLE_DURATION_MS
): PhaseTimeline {
  const normalizedSpeed = normalizeSpeedMultiplier(speedMultiplier);
  const scheduledActions: ScheduledAction[] = [];
  let timelineEndMs = 0;
  let previousStartMs = 0;

  for (let index = 0; index < phase.actions.length; index += 1) {
    const action = phase.actions[index];
    const animation = getActionAnimation(action);
    const durationMs = animation.durationMs / normalizedSpeed;
    const startMs =
      index === 0
        ? 0
        : animation.trigger === 'with_previous'
        ? previousStartMs
        : timelineEndMs;
    const endMs = startMs + durationMs;

    scheduledActions.push({
      index,
      action,
      trigger: animation.trigger,
      durationMs,
      startMs,
      endMs,
    });

    previousStartMs = startMs;
    timelineEndMs = Math.max(timelineEndMs, endMs);
  }

  const adjustedSettleDurationMs = Math.max(120, settleDurationMs / normalizedSpeed);
  return {
    scheduledActions,
    actionDurationMs: timelineEndMs,
    settleDurationMs: adjustedSettleDurationMs,
    totalDurationMs: timelineEndMs + adjustedSettleDurationMs,
  };
}

function applyMovementActionsAtTime(
  basePositions: PositionMap,
  scheduledActions: ScheduledAction[],
  elapsedMs: number
): PositionMap {
  const positions: PositionMap = {};

  for (const [objectId, point] of Object.entries(basePositions)) {
    positions[objectId] = { ...point };
  }

  for (const scheduled of scheduledActions) {
    const { action, startMs, endMs } = scheduled;
    if (!isMovementAction(action) || !action.fromObjectId) {
      continue;
    }

    if (!positions[action.fromObjectId]) {
      continue;
    }

    if (elapsedMs < startMs) {
      continue;
    }

    if (elapsedMs >= endMs) {
      positions[action.fromObjectId] = { ...action.to };
      continue;
    }

    const progress = (elapsedMs - startMs) / Math.max(1, endMs - startMs);
    positions[action.fromObjectId] = interpolatePoint(action.from, action.to, progress);
  }

  return positions;
}

function resolveBallOwnerAtTime(
  startOwnerObjectId: string | null,
  scheduledActions: ScheduledAction[],
  elapsedMs: number
): string | null {
  let ownerObjectId = startOwnerObjectId;

  for (const scheduled of scheduledActions) {
    if (!isPossessionTransferAction(scheduled.action)) {
      continue;
    }

    if (elapsedMs >= scheduled.endMs && scheduled.action.toObjectId) {
      ownerObjectId = scheduled.action.toObjectId;
    }
  }

  return ownerObjectId;
}

function interpolatePositionMaps(
  fromMap: PositionMap,
  toMap: PositionMap,
  progress: number
): PositionMap {
  const map: PositionMap = {};
  const allObjectIds = new Set([
    ...Object.keys(fromMap),
    ...Object.keys(toMap),
  ]);

  for (const objectId of allObjectIds) {
    const from = fromMap[objectId];
    const to = toMap[objectId];

    if (from && to) {
      map[objectId] = interpolatePoint(from, to, progress);
      continue;
    }

    map[objectId] = { ...(to || from)! };
  }

  return map;
}

export function compilePlayPlayback(
  diagram: BasketballPlayDocument,
  speedMultiplier = 1
): CompiledPlayback {
  const transitions: CompiledTransition[] = [];
  const phaseStartOwners: Array<string | null> = [];

  if (!diagram.phases.length) {
    return { transitions, phaseStartOwners };
  }

  phaseStartOwners[0] = resolveInitialBallOwner(diagram.phases[0]);

  for (let index = 0; index < diagram.phases.length - 1; index += 1) {
    const phase = diagram.phases[index];
    const nextPhase = diagram.phases[index + 1];
    const timeline = compilePhaseTimeline(phase, speedMultiplier);
    const startOwnerObjectId = phaseStartOwners[index] || null;
    const basePositions = phasePositions(phase);
    const targetPositions = phasePositions(nextPhase);
    const postActionPositions = applyMovementActionsAtTime(
      basePositions,
      timeline.scheduledActions,
      timeline.actionDurationMs
    );
    const endOwnerObjectId = resolveBallOwnerAtTime(
      startOwnerObjectId,
      timeline.scheduledActions,
      timeline.actionDurationMs
    );

    transitions.push({
      phaseIndex: index,
      fromPhaseId: phase.id,
      toPhaseId: nextPhase.id,
      startOwnerObjectId,
      endOwnerObjectId,
      timeline,
      basePositions,
      postActionPositions,
      targetPositions,
      warnings: getPhaseActionWarnings(phase),
    });

    const nextPhaseOverride = getPhaseBallOwnerOverride(nextPhase);
    if (nextPhaseOverride !== undefined) {
      phaseStartOwners[index + 1] = nextPhaseOverride;
    } else {
      phaseStartOwners[index + 1] = endOwnerObjectId;
    }
  }

  return {
    transitions,
    phaseStartOwners,
  };
}

export function getTransitionFrame(
  transition: CompiledTransition,
  elapsedMs: number
): TransitionFrame {
  const clampedElapsed = Math.max(
    0,
    Math.min(transition.timeline.totalDurationMs, elapsedMs)
  );

  if (clampedElapsed <= transition.timeline.actionDurationMs) {
    const positions = applyMovementActionsAtTime(
      transition.basePositions,
      transition.timeline.scheduledActions,
      clampedElapsed
    );
    const owner = resolveBallOwnerAtTime(
      transition.startOwnerObjectId,
      transition.timeline.scheduledActions,
      clampedElapsed
    );
    const actionProgress =
      transition.timeline.actionDurationMs > 0
        ? clampedElapsed / transition.timeline.actionDurationMs
        : 1;

    return {
      positions,
      ballOwnerObjectId: owner,
      actionProgress: clampProgress(actionProgress),
      settleProgress: 0,
      isSettleSegment: false,
    };
  }

  const settleElapsed = clampedElapsed - transition.timeline.actionDurationMs;
  const settleProgress =
    transition.timeline.settleDurationMs > 0
      ? settleElapsed / transition.timeline.settleDurationMs
      : 1;

  return {
    positions: interpolatePositionMaps(
      transition.postActionPositions,
      transition.targetPositions,
      settleProgress
    ),
    ballOwnerObjectId: transition.endOwnerObjectId,
    actionProgress: 1,
    settleProgress: clampProgress(settleProgress),
    isSettleSegment: true,
  };
}

