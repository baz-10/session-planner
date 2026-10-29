import { HOOP } from '../engine';
import type { BallSegment, DrillAnimation, DrillKeyframe, DrillMark, DrillStep } from '../types';

// Half court, attacking the right-hand hoop. "Around the world": five cones from baseline to baseline,
// about 15 ft from the rim. One shooter moves spot to spot; a rebounder under the rim passes out,
// chases every shot (makes and misses) and passes to the next spot.
type Vec = [number, number];
const SPOTS: Vec[] = [
  [86, 40], // right baseline
  [77.5, 36], // right wing
  [73, 25], // top
  [77.5, 14], // left wing
  [86, 10], // left baseline
];
const MAKES = [true, true, false, true, true];
const REB: Vec = [82.5, 25];

const FIRST = 0.6;
const PERIOD = 2.7;
const spotAt = (k: number) => FIRST + k * PERIOD;
const END = spotAt(SPOTS.length - 1) + 2.6;

const shooter: DrillKeyframe[] = [[0, SPOTS[0][0], SPOTS[0][1]]];
const ball: BallSegment[] = [{ type: 'hold', player: 'R', start: 0, end: spotAt(0), dribble: 'never' }];
SPOTS.forEach(([x, y], k) => {
  const T = spotAt(k);
  // Catch on the spot, shoot, then move to the next cone while the rebounder chases the ball.
  shooter.push([T + 1.5, x, y]);
  const next = SPOTS[k + 1];
  if (next) shooter.push([T + 2.4, next[0], next[1]]);
  ball.push(
    { type: 'pass', from: 'R', to: 'S', start: T, end: T + 0.5 },
    { type: 'hold', player: 'S', start: T + 0.5, end: T + 0.8, dribble: 'never' },
    { type: 'shot', player: 'S', start: T + 0.8, end: T + 1.5, make: MAKES[k] },
    { type: 'rebound', to: 'R', start: T + 1.5, end: T + 1.95 },
    { type: 'hold', player: 'R', start: T + 1.95, end: next ? spotAt(k + 1) : END, dribble: 'never' },
  );
});
shooter.push([END, SPOTS[SPOTS.length - 1][0], SPOTS[SPOTS.length - 1][1]]);

// Cones sit just outside each spot (away from the rim) so the shooter's token doesn't hide them.
const cones: DrillMark[] = SPOTS.map(([x, y], k) => {
  const dx = x - HOOP.x;
  const dy = y - HOOP.y;
  const l = Math.hypot(dx, dy);
  return { kind: 'cone', x: +(x + (dx / l) * 2.2).toFixed(2), y: +(y + (dy / l) * 2.2).toFixed(2), from: 0.6 + k * 0.15, to: 99 };
});

// Presentation: setup, a freeze on the first catch to show the feet, then real time.
const RUN = 3.5;
const CATCH = spotAt(0) + 0.5;
const HOLD = 2.5;
const tAt = (tau: number) => (tau <= CATCH ? RUN + tau : RUN + tau + HOLD);
const LENGTH = tAt(END) + 2.5;

const steps: DrillStep[] = [
  {
    at: 0,
    chapter: 'Setup',
    title: 'Five spots around the arc',
    body: 'Cones from baseline to baseline, about 15 feet from the rim. The shooter starts on the right baseline.',
    callout: { player: 'S', text: 'Shooter' },
  },
  {
    at: 1.8,
    title: 'Rebounder under the rim',
    body: 'The rebounder passes out, chases every shot and passes to the next spot.',
    callout: { player: 'R', text: 'Rebounder and passer' },
  },
  {
    at: RUN,
    chapter: 'Spot by spot',
    title: 'Feet ready before the catch',
    body: 'Knees bent, hands up, feet already pointed at the rim when the ball arrives.',
    callout: { player: 'S', text: 'Feet ready before the catch' },
  },
  {
    at: tAt(CATCH),
    freeze: true,
    title: 'Catch in your shot pocket',
    body: 'Catch with the ball at your shooting pocket so you can go straight up. No dip, no extra movement.',
    callout: { player: 'S', text: 'Ready to shoot' },
  },
  {
    at: tAt(spotAt(1) + 0.4),
    title: 'Hop into the shot',
    body: 'A small hop into the catch lands both feet together, square to the rim.',
    callout: { player: 'S', text: 'Hop into the shot' },
  },
  {
    at: tAt(spotAt(2) + 1.5),
    tone: 'warning',
    title: 'Miss? Keep moving',
    body: 'The rebounder chases the miss. The shooter goes straight to the next cone.',
    callout: { player: 'R', text: 'Chase every shot' },
    quiz: {
      prompt: 'The shot is off. Who rebounds it and passes it out?',
      answer: 'R',
      choices: ['S', 'R'],
      explain: 'The rebounder chases every shot, make or miss, and passes to the next spot. The shooter goes straight to the next cone.',
    },
  },
  {
    at: tAt(spotAt(3)),
    title: 'Next spot, every time',
    body: 'Move to the next cone while the ball is in the air, so you are set before the pass.',
    callout: { player: 'S', text: 'Set before the pass' },
  },
  {
    at: tAt(END - 0.6),
    chapter: 'Scoring',
    tone: 'success',
    title: 'Count the makes',
    body: 'Go around and back for ten shots, then swap jobs. Try to beat your score next round.',
  },
];

export const spotShooting: DrillAnimation = {
  slug: 'spot-shooting',
  name: 'Around the world',
  category: 'Shooting',
  summary: 'Spot shooting from five cones around the arc. Feet ready before the catch, hop into the shot, and a rebounder who chases every ball.',
  level: 'Beginner',
  playerCount: '2+ (shooter and rebounder)',
  time: '5-10 min',
  equipment: 'One basket, 1 ball, 5 cones',
  focus: ['Shooting', 'Footwork', 'Catch and shoot', 'Rebounding'],
  court: 'half',
  length: LENGTH,
  poster: 2.6,
  clock: [
    [0, 0],
    [RUN, 0],
    [tAt(CATCH), CATCH],
    [tAt(CATCH) + HOLD, CATCH],
    [tAt(END), END],
    [LENGTH, END],
  ],
  players: [
    { id: 'S', team: 'offense', label: '1', enterAt: 0.2, name: 'Shooter' },
    { id: 'R', team: 'offense', label: '2', enterAt: 1.2, name: 'Rebounder' },
  ],
  tracks: {
    S: shooter,
    R: [[0, REB[0], REB[1]], [END, REB[0], REB[1]]],
  },
  ball,
  arrows: [
    { show: 2.4, hide: tAt(spotAt(1)), from: spotAt(0), to: spotAt(0) + 2.4, players: ['S'], passes: true },
  ],
  steps,
  marks: cones,
  setup: [
    'Five cones around the arc, from baseline to baseline, about 15 feet from the rim.',
    'One shooter at the first cone, one rebounder under the rim with the ball.',
  ],
  howItRuns: [
    'The rebounder passes to the shooter at the first cone.',
    'The shooter catches and shoots, then moves to the next cone.',
    'The rebounder chases the shot, make or miss, and passes to the next cone.',
    'Go around and back (ten shots), then swap jobs.',
  ],
  coachingPoints: [
    {
      title: 'Shooter',
      points: [
        'Feet ready before the catch: knees bent, toes to the rim.',
        'Hop into the shot so both feet land square.',
        'Catch in your shooting pocket and go straight up.',
        'Hold your follow-through until the ball hits the rim.',
      ],
    },
    {
      title: 'Rebounder',
      points: [
        'Chase every shot, make or miss.',
        'Pass to the shooter\'s target hand.',
        'Call out the score as you go.',
      ],
    },
  ],
  mistakes: [
    'Moving to the next cone late, so the shooter catches off balance.',
    'Dipping the ball low before shooting.',
    'Drifting sideways on the shot instead of landing where you took off.',
    'Rebounder letting the ball bounce away and slowing the drill down.',
  ],
  progressions: [
    'Move the cones out to the three-point line.',
    'Add a shot fake and one dribble before the shot.',
    'Play a game: first to 7 makes, or beat your last round.',
    'Add a closeout: the rebounder runs at the shooter after each pass.',
  ],
};
