import type { BallSegment, DrillAnimation, DrillArrowSet, DrillKeyframe, DrillMark, DrillStep } from '../types';

// The weave is generated from its one rule: the middle player passes to a wing and runs behind
// that wing, and the receiver comes to the middle. Five passes, then a layup.
const LANE = { top: 12, mid: 25, bot: 38 };
type Lane = keyof typeof LANE;
const IDS = ['O1', 'O2', 'O3'] as const;
type Id = (typeof IDS)[number];

const PERIOD = 0.95;
const FIRST_PASS = 0.8;
const PASSES = 5;
const SPEED = 13;
const passAt = (k: number) => FIRST_PASS + k * PERIOD;
const DRIVE_FROM = passAt(PASSES);

const rampInt = (t: number, a: number, b: number) => (t <= a ? 0 : t < b ? (t - a) ** 2 / (2 * (b - a)) : (b - a) / 2 + (t - b));
const runX = (tau: number) => 6 + SPEED * rampInt(tau, 0.1, 0.9);
const sine = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * p);

// Lane assignments before each pass, and who passes to whom.
const states: Record<Lane, Id>[] = [{ mid: 'O1', top: 'O2', bot: 'O3' }];
const passes: { from: Id; to: Id; wing: Lane }[] = [];
for (let k = 0; k < PASSES; k += 1) {
  const s = states[k];
  const wing: Lane = k % 2 === 0 ? 'top' : 'bot';
  passes.push({ from: s.mid, to: s[wing], wing });
  states.push({ ...s, mid: s[wing], [wing]: s.mid });
}
const laneOf = (s: Record<Lane, Id>, id: Id) => (Object.keys(s) as Lane[]).find((l) => s[l] === id)!;
const finisher = passes[PASSES - 1].to;

function weavePos(id: Id, tau: number): [number, number] {
  const k = Math.max(0, Math.min(PASSES - 1, Math.floor((tau - FIRST_PASS) / PERIOD)));
  if (tau < FIRST_PASS) return [runX(tau), LANE[laneOf(states[0], id)]];
  const u = Math.min(1, (tau - passAt(k)) / PERIOD);
  const before = LANE[laneOf(states[k], id)];
  const after = LANE[laneOf(states[k + 1], id)];
  const p = passes[k];
  // The passer dips behind the receiver; the receiver steps forward into the middle.
  const dip = id === p.from ? -3.5 * Math.sin(Math.PI * u) : id === p.to ? 1.5 * Math.sin(Math.PI * u) : 0;
  return [runX(tau) + dip, before + (after - before) * sine(u)];
}

const tracks: Record<string, DrillKeyframe[]> = {};
for (const id of IDS) {
  const keys: DrillKeyframe[] = [];
  for (let tau = 0; tau <= DRIVE_FROM + 1e-6; tau += 0.1) {
    const [x, y] = weavePos(id, tau);
    keys.push([+tau.toFixed(2), +x.toFixed(2), +y.toFixed(2)]);
  }
  const [x5, y5] = weavePos(id, DRIVE_FROM);
  if (id === finisher) {
    keys.push([DRIVE_FROM + 0.5, x5 + 8.5, 25.5], [6.45, 84.5, 26.5], [6.9, 86.8, 27.5], [7.6, 86, 28], [9, 86, 28]);
  } else {
    const wingY = y5 < 25 ? 9 : 41;
    keys.push([DRIVE_FROM + 0.6, x5 + 8, (y5 + wingY) / 2], [6.9, 80, wingY], [7.6, 82, wingY + (wingY < 25 ? 3 : -3)], [9, 82, wingY + (wingY < 25 ? 3 : -3)]);
  }
  tracks[id] = keys;
}

const ball: BallSegment[] = [{ type: 'hold', player: 'O1', start: 0, end: passAt(0), dribble: 'never' }];
passes.forEach((p, k) => {
  ball.push({ type: 'pass', from: p.from, to: p.to, start: passAt(k), end: passAt(k) + 0.42 });
  const holdEnd = k < PASSES - 1 ? passAt(k + 1) : 6.45;
  ball.push({ type: 'hold', player: p.to, start: passAt(k) + 0.42, end: holdEnd, dribble: k < PASSES - 1 ? 'never' : 'auto' });
});
ball.push({ type: 'shot', player: finisher, start: 6.45, end: 6.9 });

// Presentation: setup, the rule, full speed, then a 0.4x replay with a callout per pass.
const SLOW_FROM = 14;
const SLOW_RATE = 0.4;
const slowT = (tau: number) => SLOW_FROM + tau / SLOW_RATE;
const LENGTH = slowT(7.4) + 2;

const replayArrows: DrillArrowSet[] = passes.map((p, k) => ({
  show: slowT(passAt(k)) - 0.9,
  hide: slowT(passAt(k) + PERIOD) + 0.2,
  from: passAt(k),
  to: passAt(k) + PERIOD,
  players: [p.from],
  passes: true,
}));

const replayMarks: DrillMark[] = passes.flatMap((p, k) => [
  { kind: 'tag' as const, player: p.from, text: 'Go behind', from: slowT(passAt(k)), to: slowT(passAt(k) + PERIOD) },
  { kind: 'tag' as const, player: p.to, text: 'To the middle', from: slowT(passAt(k) + 0.42), to: slowT(passAt(k) + PERIOD) },
]);

const steps: DrillStep[] = [
  { at: 0, chapter: 'Setup', title: 'Three lanes, ball in the middle', body: 'Line up across the baseline: one in the middle with the ball, one on each wing.' },
  { at: 2.6, title: 'Pass and go behind', body: 'The middle player passes to a wing, then runs behind the player they passed to.' },
  { at: 5.5, chapter: 'Full speed', title: 'Full speed, no dribbles', body: 'Five passes up the floor. The ball never touches the ground until the layup.' },
  { at: SLOW_FROM - 0.4, chapter: 'Slow motion', title: 'Slow motion', body: 'Follow the passer each time. They always go behind the receiver.' },
  { at: slowT(passAt(0)), title: 'Pass 1: middle to the right', body: 'Lead the wing with the pass so they catch it on the run.' },
  { at: slowT(passAt(1)), title: 'Pass 2: the new middle goes left', body: 'The receiver has come to the middle. Now they pass and go behind.' },
  { at: slowT(passAt(3)), title: 'Keep the spacing', body: 'Wings stay wide. Cutting too early squeezes the lanes together.' },
  { at: slowT(DRIVE_FROM), tone: 'success', title: 'Finish strong', body: 'Last receiver attacks the rim. The others fill the wings for a rebound.' },
];

export const threeManWeave: DrillAnimation = {
  slug: '3-man-weave',
  name: '3-man weave',
  category: 'Passing',
  summary: 'A classic warm-up that builds passing on the move, spacing and communication: pass, go behind, repeat, then lay it up.',
  level: 'Beginner',
  playerCount: '3+ (groups of 3)',
  time: '5-8 min',
  equipment: 'Full court, 1 ball per group',
  focus: ['Passing on the move', 'Spacing', 'Finishing', 'Conditioning'],
  court: 'full',
  length: LENGTH,
  poster: 4.6,
  clock: [
    [0, 0],
    [5.5, 0],
    [13, 7.5],
    [13.4, 7.5],
    [13.4, 0],
    [SLOW_FROM, 0],
    [slowT(7.4), 7.4],
    [LENGTH, 7.4],
  ],
  players: IDS.map((id, i) => ({ id, team: 'offense' as const, label: String(i + 1), enterAt: 0.2 + i * 0.18 })),
  tracks,
  ball,
  arrows: [
    { show: 2.8, hide: 9, from: 0, to: passAt(2), players: [...IDS], passes: true },
    ...replayArrows,
  ],
  steps,
  marks: [
    { kind: 'lane', y1: 7, y2: 17, text: 'Wing lane', from: 0.8, to: 5.6 },
    { kind: 'lane', y1: 20, y2: 30, text: 'Middle lane', from: 0.95, to: 5.6 },
    { kind: 'lane', y1: 33, y2: 43, text: 'Wing lane', from: 1.1, to: 5.6 },
    ...replayMarks,
  ],
  setup: [
    'Three lines on the baseline: middle, left wing and right wing.',
    'The middle player has the ball.',
  ],
  howItRuns: [
    'The middle passes to a wing and runs behind that player.',
    'The receiver comes to the middle and passes to the other wing, then goes behind.',
    'Keep weaving up the floor with no dribbles. The last receiver lays it up.',
    'Weave back the other way, or the next three go.',
  ],
  coachingPoints: [
    {
      title: 'Passing',
      points: [
        'Lead the receiver: pass to where they are going, not where they are.',
        'Chest passes, hands ready to catch with thumbs up.',
        'Call the receiver\'s name before every pass.',
      ],
    },
    {
      title: 'Movement',
      points: [
        'Always go behind the player you passed to.',
        'Wings stay wide until the free-throw line.',
        'Sprint. The weave is a running drill, not a passing drill at walking pace.',
      ],
    },
  ],
  mistakes: [
    'Running in front of the receiver instead of behind them.',
    'Travelling: catching on the run takes a jump stop or a legal two-step.',
    'Lanes collapsing into the middle so all three players bunch up.',
  ],
  progressions: [
    'Require a set number of passes before the layup (for example five).',
    'Finish with a jump shot from the elbow instead of a layup.',
    'Add a defender at the far end to make it a 3-on-1 finish.',
    'Race the clock: down and back in under 20 seconds.',
  ],
};
