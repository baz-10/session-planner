// Drill animations are authored in court feet: x runs 0-94 along the court (attacking the right-hand
// hoop at x = 88.75), y runs 0-50 across it. Two clocks are used:
//   t  = presentation time (what the scrubber shows, steps, arrows, marks)
//   tau = drill time (where players and the ball are), mapped from t by `clock` so the
//         animation can freeze on a coaching point or replay in slow motion.

export type DrillTeam = 'offense' | 'defense';

export interface DrillPlayer {
  id: string;
  team: DrillTeam;
  label: string;
  /** Presentation time the token pops onto the court. Defaults to 0. */
  enterAt?: number;
}

/** [tau, x, y] or [tau, x, y, 'jump'] to teleport (used to reset between reps). */
export type DrillKeyframe =
  | [number, number, number]
  | [number, number, number, 'jump'];

export type BallSegment =
  | { type: 'hold'; player: string; start: number; end: number; dribble?: 'auto' | 'always' | 'never' }
  | { type: 'pass'; from: string; to: string; start: number; end: number; style?: 'chest' | 'bounce' | 'lob' }
  | { type: 'shot'; player: string; start: number; end: number };

/** Coaching-diagram arrows for the movement in [from, to] (tau), drawn on at `show` and gone by `hide` (t). */
export interface DrillArrowSet {
  show: number;
  hide: number;
  from: number;
  to: number;
  players?: string[];
  passes?: boolean;
}

export type DrillTone = 'teach' | 'warning' | 'success';

export interface DrillStep {
  /** Presentation time the step starts. It runs until the next step. */
  at: number;
  title: string;
  body?: string;
  tone?: DrillTone;
  /** Shows a "Paused" badge: use when the clock holds tau still for a coaching point. */
  freeze?: boolean;
  /** Steps with a chapter name appear in the step list and can be jumped to. */
  chapter?: string;
}

export type DrillMark =
  | { kind: 'tag'; player: string; text: string; from: number; to: number; tone?: DrillTone }
  | { kind: 'ring'; player: string; from: number; to: number; tone?: DrillTone }
  | { kind: 'link'; a: string; b: string; text?: string; from: number; to: number; tone?: DrillTone }
  | { kind: 'lane'; y1: number; y2: number; text: string; from: number; to: number }
  | { kind: 'label'; x: number; y: number; text: string; from: number; to: number; tone?: DrillTone }
  | { kind: 'triangle'; players: [string, string, string]; text?: string; from: number; to: number };

/** A countdown in drill time, e.g. the window before the trailing defender arrives. */
export interface DrillMeter {
  label: string;
  /** Presentation-time window the meter is on screen. */
  from: number;
  to: number;
  /** Drill time the countdown starts and runs out. */
  start: number;
  end: number;
  /** Drill time the rep is decided; the meter stops there and shows the outcome. */
  resolveAt?: number;
  outcome?: 'success' | 'fail';
  outcomeText?: string;
}

export interface DrillAnimation {
  slug: string;
  name: string;
  category: string;
  summary: string;
  level: string;
  playerCount: string;
  time: string;
  equipment: string;
  focus: string[];
  court: 'full' | 'half';
  /** Presentation length in seconds. */
  length: number;
  /** Presentation time to show before the first play. */
  poster?: number;
  /** [t, tau] pairs. A repeated t with a new tau is a jump cut. Equal tau over a span is a freeze. */
  clock: Array<[number, number]>;
  players: DrillPlayer[];
  tracks: Record<string, DrillKeyframe[]>;
  ball: BallSegment[];
  arrows: DrillArrowSet[];
  steps: DrillStep[];
  marks: DrillMark[];
  meters?: DrillMeter[];
  setup: string[];
  howItRuns: string[];
  coachingPoints: { title: string; points: string[] }[];
  mistakes: string[];
  progressions: string[];
}
