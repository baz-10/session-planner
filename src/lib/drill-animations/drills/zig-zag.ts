import type { DrillAnimation, DrillKeyframe, DrillMark } from '../types';

// Full-court zig-zag. Cones zig-zag between the sideline (y = 8) and the lane line (y = 22).
// The ball handler dribbles cone to cone, pausing to change direction at each one. The defender
// stays in front: the defender's spot is where the ball handler will be a moment later, an arm's
// length further down the floor. On the third leg the defender is beaten on the crossover, drops
// a step, turns and runs, then gets back in front.
const CONES: [number, number][] = [
  [4, 8], [16, 22], [28, 8], [40, 22], [52, 8], [64, 22], [76, 8], [88, 22],
];
const ROUTE = CONES.slice(0, 5);
const START = 0.5;
const LEG = 2.2;
const PAUSE = 0.45;
const END_TAU = 11.0;

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Ball handler keyframes: a short hold at each cone so the direction change reads as a plant.
const o1Keys: DrillKeyframe[] = [[0, ...ROUTE[0]], [START, ...ROUTE[0]]];
for (let i = 1; i < ROUTE.length; i += 1) {
  const arrive = START + i * LEG + (i - 1) * PAUSE;
  o1Keys.push([+arrive.toFixed(2), ...ROUTE[i]]);
  o1Keys.push([+(i < ROUTE.length - 1 ? arrive + PAUSE : END_TAU).toFixed(2), ...ROUTE[i]]);
}

// With a hold either side of every leg, the engine moves the ball handler with smoothstep easing.
function o1At(tau: number): [number, number] {
  if (tau <= o1Keys[0][0]) return [o1Keys[0][1], o1Keys[0][2]];
  for (let i = 0; i < o1Keys.length - 1; i += 1) {
    const [t0, x0, y0] = o1Keys[i];
    const [t1, x1, y1] = o1Keys[i + 1];
    if (tau <= t1) {
      const u = smooth(clamp01((tau - t0) / (t1 - t0)));
      return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
    }
  }
  const last = o1Keys[o1Keys.length - 1];
  return [last[1], last[2]];
}

// How far in front the defender is: 1 = in front, below 0 = beaten. Beaten on leg 3, recovered by the next cone.
function inFront(tau: number): number {
  if (tau < 5.8 || tau > 7.75) return 1;
  if (tau < 6.55) return 1 - 1.3 * (0.5 - 0.5 * Math.cos(Math.PI * (tau - 5.8) / 0.75));
  if (tau < 6.95) return -0.3;
  return -0.3 + 1.3 * (0.5 - 0.5 * Math.cos(Math.PI * (tau - 6.95) / 0.8));
}

const x1Keys: DrillKeyframe[] = [];
for (let tau = 0; tau <= END_TAU + 1e-6; tau += 0.1) {
  const k = inFront(tau);
  const [x, y] = o1At(tau + 0.35);
  x1Keys.push([+tau.toFixed(2), +(x + 3.2 * k).toFixed(2), +(y - 3.4 * (1 - k)).toFixed(2)]);
}

const SETUP = 4;
const tRun = (tau: number) => SETUP + tau;
const RUN_END = 10.8;
const SLOW = { at: 15.5, from: 5.6, to: 8.4, rate: 0.4 };
const tSlow = (tau: number) => SLOW.at + (tau - SLOW.from) / SLOW.rate;
const LENGTH = tSlow(SLOW.to) + 4.5;

const cones: DrillMark[] = CONES.map(([x, y], i) => ({ kind: 'cone', x, y, from: 0.4 + i * 0.12, to: LENGTH }));

export const zigZag: DrillAnimation = {
  slug: 'zig-zag',
  name: 'Zig-zag',
  category: 'Defence',
  summary:
    'The classic on-ball defence drill. A ball handler zig-zags cone to cone while the defender slides to stay in front, and turns and runs to recover when beaten.',
  level: 'Beginner',
  playerCount: '2+ (pairs)',
  time: '5-8 min',
  equipment: 'Full court, 1 ball per pair, 8 cones',
  focus: ['On-ball defence', 'Defensive slides', 'Footwork', 'Ball handling'],
  court: 'full',
  length: LENGTH,
  poster: 3.6,
  clock: [
    [0, 0],
    [SETUP, 0],
    [tRun(RUN_END), RUN_END],
    [SLOW.at - 0.4, RUN_END],
    [SLOW.at - 0.4, SLOW.from],
    [SLOW.at, SLOW.from],
    [tSlow(SLOW.to), SLOW.to],
    [LENGTH, SLOW.to],
  ],
  camera: [
    [0, 47, 25, 105.6],
    [SETUP + 0.2, 47, 25, 105.6],
    [SETUP + 1.4, 'ball', 15, 60],
    [tRun(RUN_END), 'ball', 15, 60],
    [SLOW.at, 'ball', 15, 46],
    [tSlow(SLOW.to), 'ball', 15, 46],
    [tSlow(SLOW.to) + 1.4, 47, 25, 105.6],
    [LENGTH, 47, 25, 105.6],
  ],
  players: [
    { id: 'O1', team: 'offense', label: '1', name: 'Ball handler', enterAt: 1.4 },
    { id: 'X1', team: 'defense', label: 'X1', name: 'Defender', enterAt: 1.6 },
  ],
  tracks: { O1: o1Keys, X1: x1Keys },
  ball: [{ type: 'hold', player: 'O1', start: 0, end: END_TAU, dribble: 'always' }],
  arrows: [
    { show: 2.2, hide: tRun(1.2), from: 0, to: 5.4, players: ['O1'] },
    { show: SLOW.at + 0.2, hide: tSlow(8.0), from: 5.8, to: 8.0, players: ['X1'] },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Cones in a zig-zag',
      body: 'Set cones in a zig-zag from baseline to baseline, between the sideline and the lane line.',
      callout: { player: 'O1', text: 'Ball handler' },
    },
    {
      at: 2,
      title: 'Defender in front',
      body: 'The defender starts in stance, an arm\'s length in front of the ball.',
      callout: { player: 'X1', text: 'Defender' },
    },
    {
      at: SETUP,
      chapter: 'Full speed',
      title: 'Dribble cone to cone',
      body: 'The ball handler changes direction at every cone. Start at half speed.',
      callout: { player: 'O1', text: 'Change direction at each cone' },
    },
    {
      at: tRun(0.6),
      title: 'Nose on the ball',
      body: 'Stay in front with your nose on the ball and your hands active.',
      callout: { player: 'X1', text: 'Nose on the ball' },
    },
    {
      at: tRun(3.0),
      title: 'Slide, don\'t cross your feet',
      body: 'Push off the back foot and slide. Crossing your feet leaves you off balance.',
      callout: { player: 'X1', text: 'Slide, don\'t cross your feet' },
    },
    {
      at: tRun(5.9),
      tone: 'warning',
      title: 'Beaten on the crossover',
      body: 'The ball handler gets a step. Sliding won\'t catch them now.',
      callout: { player: 'X1', text: 'Drop step and turn' },
    },
    {
      at: tRun(7.75),
      tone: 'success',
      title: 'Back in front',
      body: 'Turn and run to beat the ball handler to the next spot, then get back in stance.',
      callout: { player: 'X1', text: 'Back in front' },
    },
    {
      at: SLOW.at - 0.4,
      chapter: 'Slow motion',
      tone: 'warning',
      title: 'When you\'re beaten',
      body: 'Watch the defender\'s hips on the crossover.',
      callout: { player: 'X1', text: 'Watch the hips' },
    },
    {
      at: tSlow(6.0),
      title: 'Drop step',
      body: 'Open the hips toward the ball with a drop step.',
      callout: { player: 'X1', text: 'Drop step' },
    },
    {
      at: tSlow(6.6),
      title: 'Turn and run',
      body: 'Sprint to the spot the ball handler is heading for. Don\'t try to slide back into it.',
      callout: { player: 'X1', text: 'Turn and run, don\'t slide' },
    },
    {
      at: tSlow(7.7),
      tone: 'success',
      title: 'Slide again',
      body: 'Once you\'re back in front, get low and slide again.',
      callout: { player: 'X1', text: 'Slide again' },
    },
    {
      at: tSlow(SLOW.to),
      chapter: 'Key rule',
      tone: 'success',
      title: 'Stay in front, beat them to the spot',
      body: 'Slide when you can, turn and run when you can\'t, then get back in stance.',
    },
  ],
  marks: [
    ...cones,
    { kind: 'ring', player: 'X1', from: tSlow(5.9), to: tSlow(8.0), tone: 'warning' },
  ],
  setup: [
    'Set 8 cones in a zig-zag from baseline to baseline, between the sideline and the lane line.',
    'Pairs: one ball handler, one defender. Start on the baseline.',
  ],
  howItRuns: [
    'The ball handler dribbles cone to cone, changing direction at each one.',
    'The defender slides to stay in front and turns the ball handler at each cone.',
    'Start at half speed with the defender\'s hands behind their back, then go live.',
    'Swap roles at the far baseline and come back.',
  ],
  coachingPoints: [
    {
      title: 'Defender',
      points: [
        'Nose on the ball, low stance, weight on the balls of your feet.',
        'Slide, don\'t cross your feet.',
        'When beaten: drop step, turn and run, then get back in front.',
      ],
    },
    {
      title: 'Ball handler',
      points: [
        'Change direction hard at each cone.',
        'Keep your body between the defender and the ball.',
        'Eyes up, not on the ball.',
      ],
    },
  ],
  mistakes: [
    'Standing up tall between slides.',
    'Reaching for the ball instead of moving the feet.',
    'Trying to slide back into position after being beaten.',
    'Ball handler going straight to the next cone with no change of direction.',
  ],
  progressions: [
    'Defender keeps hands behind their back so the work is all feet.',
    'Let the ball handler try to beat the defender down the floor.',
    'Narrow the zig-zag to one lane width so the cuts are sharper.',
  ],
};
