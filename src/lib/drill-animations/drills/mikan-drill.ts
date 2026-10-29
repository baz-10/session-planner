import type { BallSegment, DrillAnimation, DrillKeyframe, DrillStep } from '../types';

// Half court, attacking the right-hand hoop. One player alternates layups on each side of the rim,
// catching the ball out of the net and stepping across under the basket. Six makes at full speed,
// then a 0.4x replay of the first two.
const RIGHT = [85.8, 28.6] as const; // right side of the rim (as the player faces the basket)
const LEFT = [85.8, 21.4] as const;
const FIRST = 0.8;
const PERIOD = 1.3;
const MAKES = 6;
const shotAt = (i: number) => FIRST + i * PERIOD;
const sideOf = (i: number) => (i % 2 === 0 ? RIGHT : LEFT);
const END = shotAt(MAKES - 1) + 1.6;

const track: DrillKeyframe[] = [[0, RIGHT[0], RIGHT[1]]];
const ball: BallSegment[] = [{ type: 'hold', player: 'P', start: 0, end: FIRST, dribble: 'never' }];
for (let i = 0; i < MAKES; i += 1) {
  const s = shotAt(i);
  const [x, y] = sideOf(i);
  const [nx, ny] = sideOf(i + 1);
  // Release, then step across under the rim and arrive (stopped) as the ball drops out of the net.
  track.push([s, x, y], [s + 0.35, x, y]);
  if (i < MAKES - 1) track.push([s + 0.95, nx, ny]);
  ball.push({ type: 'shot', player: 'P', start: s, end: s + 0.4 });
  if (i < MAKES - 1) {
    ball.push({ type: 'rebound', to: 'P', start: s + 0.4, end: s + 0.95 });
    ball.push({ type: 'hold', player: 'P', start: s + 0.95, end: shotAt(i + 1), dribble: 'never' });
  }
}
track.push([END, sideOf(MAKES - 1)[0], sideOf(MAKES - 1)[1]]);

// Presentation clock: setup, full speed, then a slow-motion replay of the first two layups.
const RUN = 3;
const REPLAY = { at: RUN + END + 0.5, from: FIRST - 0.1, to: shotAt(2) - 0.1, rate: 0.4 };
const tReplay = (tau: number) => REPLAY.at + (tau - REPLAY.from) / REPLAY.rate;
const REPLAY_END = tReplay(REPLAY.to);
const LENGTH = REPLAY_END + 3;

const steps: DrillStep[] = [
  {
    at: 0,
    chapter: 'Setup',
    title: 'One player, one ball',
    body: 'Start on the right block, close to the rim, with the ball held high.',
    callout: { player: 'P', text: 'Ball high' },
  },
  {
    at: 1.4,
    title: 'Finish on both sides',
    body: 'Right side, then left side, then right again. Keep alternating without stopping.',
  },
  {
    at: RUN,
    chapter: 'Full speed',
    title: 'Make, catch, step across',
    body: 'Catch it out of the net, step across under the rim and finish on the other side.',
    callout: { player: 'P', text: 'Catch it out of the net' },
  },
  {
    at: RUN + shotAt(3),
    title: 'Find a rhythm',
    body: 'Aim for ten makes in a row, or as many as you can in 30 seconds.',
  },
  {
    at: REPLAY.at,
    chapter: 'Slow motion',
    title: 'Right side: left foot, right hand',
    body: 'Jump off the left foot, lift the right knee, and lay it softly off the backboard with the right hand.',
    callout: { player: 'P', text: 'Left foot, right hand' },
  },
  {
    at: tReplay(shotAt(0) + 0.4),
    title: 'Step across, ball stays high',
    body: 'Catch above your head and step under the rim. Never bring the ball down below your chin.',
    callout: { player: 'P', text: 'Keep it above the chin' },
  },
  {
    at: tReplay(shotAt(1) - 0.05),
    title: 'Left side: right foot, left hand',
    body: 'Jump off the right foot and finish with the left hand, using the backboard.',
    callout: { player: 'P', text: 'Right foot, left hand' },
  },
  {
    at: REPLAY_END,
    chapter: 'Key rule',
    tone: 'success',
    title: 'Never let the ball drop',
    body: 'Catch high, step across, finish high. Use the backboard on every layup.',
  },
];

export const mikanDrill: DrillAnimation = {
  slug: 'mikan-drill',
  name: 'Mikan drill',
  category: 'Finishing',
  summary: 'Alternating layups on both sides of the rim, catching the ball out of the net each time. Builds footwork, touch and the habit of keeping the ball high.',
  level: 'Beginner',
  playerCount: '1+ (one ball each)',
  time: '3-5 min',
  equipment: 'One basket, 1 ball per player',
  focus: ['Finishing', 'Footwork', 'Both hands', 'Touch'],
  court: 'half',
  length: LENGTH,
  poster: 1.8,
  clock: [
    [0, 0],
    [RUN, 0],
    [RUN + END, END],
    [REPLAY.at, END],
    [REPLAY.at, REPLAY.from],
    [REPLAY_END, REPLAY.to],
    [LENGTH, REPLAY.to],
  ],
  players: [{ id: 'P', team: 'offense', label: '1', enterAt: 0.2, name: 'Player' }],
  tracks: { P: track },
  ball,
  arrows: [
    { show: 1.6, hide: RUN + 0.6, from: FIRST, to: shotAt(1) + 0.4, players: ['P'], passes: true },
    { show: REPLAY.at + 0.2, hide: REPLAY_END, from: FIRST, to: shotAt(2) - 0.1, players: ['P'], passes: true },
  ],
  steps,
  marks: [
    { kind: 'label', x: 81, y: 33.5, text: 'Right side', from: 1.4, to: RUN + 0.4 },
    { kind: 'label', x: 81, y: 16.5, text: 'Left side', from: 1.6, to: RUN + 0.4 },
  ],
  setup: [
    'One player under the basket with a ball. Pair up and share a ball if you are short.',
    'Start on the right block, a step from the rim.',
  ],
  howItRuns: [
    'Lay it up on the right side with the right hand.',
    'Catch it out of the net before it hits the floor, step across and lay it up on the left with the left hand.',
    'Keep alternating for a set time or a set number of makes.',
  ],
  coachingPoints: [
    {
      title: 'Footwork',
      points: [
        'Right side: jump off the left foot, right hand finishes.',
        'Left side: jump off the right foot, left hand finishes.',
        'Short, quick steps across under the rim.',
      ],
    },
    {
      title: 'Ball and finish',
      points: [
        'Keep the ball above the chin the whole time.',
        'Use the backboard: aim for the top corner of the small square.',
        'Soft hands. Lay it up, don\'t throw it.',
      ],
    },
  ],
  mistakes: [
    'Bringing the ball down to the waist between layups.',
    'Using the wrong foot or wrong hand on the weak side.',
    'Letting the ball bounce instead of catching it out of the net.',
    'Drifting away from the rim so each layup gets longer.',
  ],
  progressions: [
    'Reverse Mikan: finish on the far side of the rim with a reverse layup.',
    'Count makes in 30 seconds and try to beat it.',
    'Add a power dribble before each finish.',
    'Hold a second ball and alternate balls each layup.',
  ],
};
