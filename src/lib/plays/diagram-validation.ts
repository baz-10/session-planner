import type {
  ActionType,
  AnimationTrigger,
  BasketballPlayDocument,
  CourtTemplate,
  PlayAction,
  PlayObject,
  PlayObjectType,
  Point2D,
} from './diagram-types';

const MIN_COORD = 0;
const MAX_COORD = 1000;
const VALID_ACTION_TYPES: ActionType[] = ['dribble', 'pass', 'cut', 'screen', 'shot', 'handoff'];
const VALID_OBJECT_TYPES: PlayObjectType[] = [
  'offense_player',
  'defense_player',
  'ball',
  'cone',
  'text',
  'shape_rect',
  'shape_circle',
];
const VALID_COURT_TEMPLATES: CourtTemplate[] = [
  'half_court',
  'full_court_vertical',
  'full_court_horizontal',
];
const VALID_ANIMATION_TRIGGERS: AnimationTrigger[] = ['after_previous', 'with_previous'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArrayValue<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

function isValidPoint(point: unknown): point is Point2D {
  if (!point || typeof point !== 'object') return false;
  const { x, y } = point as Point2D;
  return (
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    x >= MIN_COORD &&
    x <= MAX_COORD &&
    y >= MIN_COORD &&
    y <= MAX_COORD
  );
}

function isValidObject(object: unknown): object is PlayObject {
  if (!object || typeof object !== 'object') return false;
  const candidate = object as PlayObject;
  return (
    typeof candidate.id === 'string' &&
    isStringArrayValue(candidate.type, VALID_OBJECT_TYPES) &&
    (candidate.label === undefined || typeof candidate.label === 'string') &&
    isValidPoint(candidate.position)
  );
}

function isValidActionAnimation(animation: unknown): boolean {
  if (!animation || typeof animation !== 'object') return false;

  const candidate = animation as PlayAction['animation'];
  return (
    !!candidate &&
    isStringArrayValue(candidate.trigger, VALID_ANIMATION_TRIGGERS) &&
    isFiniteNumber(candidate.durationMs) &&
    candidate.durationMs > 0
  );
}

function isValidAction(action: unknown): action is PlayAction {
  if (!action || typeof action !== 'object') return false;
  const candidate = action as PlayAction;
  return (
    typeof candidate.id === 'string' &&
    isStringArrayValue(candidate.type, VALID_ACTION_TYPES) &&
    isValidPoint(candidate.from) &&
    isValidPoint(candidate.to) &&
    (candidate.fromObjectId === undefined || typeof candidate.fromObjectId === 'string') &&
    (candidate.toObjectId === undefined || typeof candidate.toObjectId === 'string') &&
    (candidate.animation === undefined || isValidActionAnimation(candidate.animation))
  );
}

export function validateBasketballPlayDocument(
  doc: unknown
): { valid: true } | { valid: false; error: string } {
  if (!doc || typeof doc !== 'object') {
    return { valid: false, error: 'Invalid diagram payload' };
  }

  const candidate = doc as BasketballPlayDocument;

  if (candidate.schemaVersion !== 1) {
    return { valid: false, error: 'Unsupported play diagram schema version' };
  }

  if (!isStringArrayValue(candidate.courtTemplate, VALID_COURT_TEMPLATES)) {
    return { valid: false, error: 'Unsupported court template' };
  }

  if (!Array.isArray(candidate.phases) || candidate.phases.length === 0) {
    return { valid: false, error: 'Play must include at least one phase' };
  }

  for (const phase of candidate.phases) {
    if (!phase || typeof phase !== 'object') {
      return { valid: false, error: 'Invalid phase object' };
    }

    if (typeof phase.id !== 'string' || typeof phase.name !== 'string') {
      return { valid: false, error: 'Phase id and name are required' };
    }

    if (!Array.isArray(phase.objects) || !phase.objects.every(isValidObject)) {
      return { valid: false, error: `Phase ${phase.name} has invalid objects` };
    }

    if (!Array.isArray(phase.actions) || !phase.actions.every(isValidAction)) {
      return { valid: false, error: `Phase ${phase.name} has invalid actions` };
    }

    if (
      phase.ballOwnerObjectId !== undefined &&
      phase.ballOwnerObjectId !== null &&
      typeof phase.ballOwnerObjectId !== 'string'
    ) {
      return { valid: false, error: `Phase ${phase.name} has invalid ball owner` };
    }
  }

  return { valid: true };
}
