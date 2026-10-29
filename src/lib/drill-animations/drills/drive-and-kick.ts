import type { DrillAnimation } from '../types';

// Half court, attacking the right-hand hoop. 4-out: guards 1 and 2 above the arc, 3 in the right
// corner, 4 on the left wing. 1 drives the gap, X3 leaves the corner to help, and 1 kicks to 3.
// One full-speed rep with a freeze on the read, then a half-speed replay.
const SETUP = 4.5;
const READ_TAU = 2.95;
const HOLD = 3.5;
const tRun = (tau: number) => (tau <= READ_TAU ? SETUP + tau : SETUP + tau + HOLD);
const REPLAY = { at: tRun(5) + 0.4, from: 1.2, to: 4.6, rate: 0.5 };
const tReplay = (tau: number) => REPLAY.at + 0.4 + (tau - REPLAY.from) / REPLAY.rate;
const LENGTH = tReplay(REPLAY.to) + 3.2;

export const driveAndKick: DrillAnimation = {
  slug: 'drive-and-kick',
  name: 'Drive and kick',
  category: 'Offence',
  summary:
    'Drive the gap, make a help defender commit, and kick the ball to the player they left. Teammates drift and lift so the passing lanes stay open.',
  level: 'Intermediate',
  playerCount: '8 (4-on-4)',
  time: '8-10 min',
  equipment: 'Half court, 1 ball',
  focus: ['Penetration', 'Spacing', 'Passing out of the drive', 'Catch and shoot'],
  court: 'half',
  length: LENGTH,
  poster: 3.4,
  clock: [
    [0, 0],
    [SETUP, 0],
    [tRun(READ_TAU), READ_TAU],
    [tRun(READ_TAU) + HOLD, READ_TAU],
    [tRun(5), 5],
    [REPLAY.at, 5],
    [REPLAY.at, REPLAY.from],
    [tReplay(REPLAY.from), REPLAY.from],
    [tReplay(REPLAY.to), REPLAY.to],
    [LENGTH, REPLAY.to],
  ],
  players: [
    { id: 'O1', team: 'offense', label: '1', enterAt: 0.2 },
    { id: 'O2', team: 'offense', label: '2', enterAt: 0.3 },
    { id: 'O3', team: 'offense', label: '3', enterAt: 0.4 },
    { id: 'O4', team: 'offense', label: '4', enterAt: 0.5 },
    { id: 'X1', team: 'defense', label: 'X1', enterAt: 0.9 },
    { id: 'X2', team: 'defense', label: 'X2', enterAt: 1.0 },
    { id: 'X3', team: 'defense', label: 'X3', enterAt: 1.1 },
    { id: 'X4', team: 'defense', label: 'X4', enterAt: 1.2 },
  ],
  tracks: {
    O1: [
      [0, 63.5, 32.5], [1.2, 63.5, 32.5], [1.6, 65, 35.5], [2.2, 71, 36], [2.8, 78, 34], [3.1, 79.5, 33.5], [5, 79.5, 33.5],
    ],
    X1: [
      [0, 66.5, 31.5], [1.2, 66.5, 31.5], [1.6, 67.5, 31.8], [2.4, 72, 33.6], [3.0, 75.5, 34], [5, 76, 33.5],
    ],
    O2: [[0, 63.5, 17.5], [2.2, 63.5, 17.5], [3.0, 62, 24], [5, 62, 24]],
    X2: [[0, 72, 21], [2.2, 72, 21], [2.8, 74.5, 24], [5, 74.5, 24]],
    O3: [[0, 86, 47], [5, 86, 47]],
    X3: [[0, 84, 43], [2.2, 84, 43], [2.9, 81.5, 37], [3.6, 82, 38.5], [4.3, 84.3, 44], [5, 84.3, 44]],
    O4: [[0, 77, 5], [2.2, 77, 5], [3.2, 85, 3.5], [5, 85, 3.5]],
    X4: [[0, 78.5, 8.5], [2.2, 78.5, 8.5], [3.2, 84.5, 8], [5, 84.5, 8]],
  },
  ball: [
    { type: 'hold', player: 'O1', start: 0, end: 3.15 },
    { type: 'pass', from: 'O1', to: 'O3', start: 3.15, end: 3.6 },
    { type: 'hold', player: 'O3', start: 3.6, end: 3.85, dribble: 'never' },
    { type: 'shot', player: 'O3', start: 3.85, end: 4.55 },
  ],
  arrows: [
    { show: SETUP + 0.2, hide: tRun(READ_TAU), from: 1.2, to: READ_TAU, players: ['O1', 'O2', 'O4'] },
    { show: tRun(2.2), hide: tRun(READ_TAU), from: 2.2, to: READ_TAU, players: ['X3'] },
    { show: tRun(READ_TAU) + 0.2, hide: tRun(4.6), from: READ_TAU, to: 4.55, passes: true },
    { show: REPLAY.at + 0.1, hide: tReplay(REPLAY.to), from: REPLAY.from, to: 4.55, players: ['O1'], passes: true },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Four out',
      body: 'Four attackers spaced around the arc: two guards up top, 3 in the corner and 4 on the far wing.',
      callout: { player: 'O1', text: 'Ball handler' },
    },
    {
      at: 2.3,
      title: 'Spacing is the drill',
      body: 'Every attacker stands where one pass reaches them and their defender can\'t guard two people.',
      callout: { player: 'O3', text: 'Corner' },
    },
    {
      at: SETUP,
      chapter: 'Full speed',
      title: 'Attack the gap',
      body: '1 drives past X1 into the space between the defenders.',
      callout: { player: 'O1', text: 'Drive the gap' },
    },
    {
      at: tRun(2.2),
      title: 'Teammates move',
      body: '4 drifts to the corner and 2 lifts toward the top, so the passing lanes stay open.',
      callout: { player: 'O4', text: 'Drift' },
    },
    {
      at: tRun(READ_TAU),
      freeze: true,
      tone: 'warning',
      title: 'Help commits',
      body: 'X3 has left the corner to stop the drive. That leaves 3 open.',
      callout: { player: 'X3', text: 'Help steps over' },
      quiz: {
        prompt: 'X3 has left the corner to stop the drive. Who is open?',
        answer: 'O3',
        choices: ['O2', 'O3', 'O4'],
        explain: 'X3\'s player: 3 in the corner. Kick it straight there. One pass beats the closeout.',
      },
    },
    {
      at: tRun(READ_TAU) + HOLD,
      title: 'Kick to the corner',
      body: '1 jump-stops and passes to 3 before X3 can get back.',
      callout: { player: 'O1', text: 'Kick' },
    },
    {
      at: tRun(3.85),
      tone: 'success',
      title: 'Catch and shoot',
      body: '3 has hands ready and feet set, and shoots on the catch.',
      callout: { player: 'O3', text: 'Shoot it' },
    },
    {
      at: REPLAY.at,
      chapter: 'Slow motion',
      title: 'Watch the help',
      body: 'Half speed: as soon as X3 steps toward the ball, 3 is the pass.',
      callout: { player: 'X3', text: 'Helper' },
    },
    {
      at: tReplay(3.1),
      title: 'Find the helper\'s player',
      body: 'The driver looks for whoever the helper just left.',
      callout: { player: 'O3', text: 'Open' },
    },
    {
      at: tReplay(REPLAY.to),
      chapter: 'Key rule',
      tone: 'success',
      title: 'Drive, draw, kick',
      body: 'Drive to make a defender commit, then pass to the player that defender left.',
    },
  ],
  marks: [
    { kind: 'tag', player: 'X3', text: 'Helps', from: tRun(READ_TAU) + 0.1, to: tRun(READ_TAU) + HOLD, tone: 'warning' },
    { kind: 'tag', player: 'O3', text: 'Open', from: tRun(READ_TAU) + 0.5, to: tRun(READ_TAU) + HOLD, tone: 'success' },
    { kind: 'ring', player: 'O3', from: tRun(READ_TAU) + 0.5, to: tRun(READ_TAU) + HOLD, tone: 'success' },
  ],
  setup: [
    'Four attackers spaced around the arc: two guards, one in each corner or wing.',
    'Four defenders, one on each attacker. Start with the ball at a guard spot.',
  ],
  howItRuns: [
    'The ball handler drives a gap between two defenders.',
    'Teammates move as the drive starts: drift toward the corner, or lift higher on the wing.',
    'When a help defender steps over, the driver passes to that defender\'s player.',
    'The receiver catches ready and shoots, or drives the closeout.',
    'Play live until a score or a stop, then rotate.',
  ],
  coachingPoints: [
    {
      title: 'Driver',
      points: [
        'Attack the gap, not the defender.',
        'Eyes up: find the help defender before you pass.',
        'Jump-stop under control and pass with either hand.',
      ],
    },
    {
      title: 'Spacing',
      points: [
        'Drift away from the drive along the arc, or lift higher on the wing.',
        'Show hands and be ready to shoot on the catch.',
        'Stay behind the 3-point line so the help has further to recover.',
      ],
    },
  ],
  mistakes: [
    'Driving into a crowd with no plan to pass.',
    'Shooters standing still, so the help defender can guard both.',
    'Passing to the player whose defender didn\'t help.',
    'Catching flat-footed and wasting the open shot.',
  ],
  progressions: [
    'Defence can choose who helps; the driver reads it live.',
    'Add a second kick: the closeout is hard, so swing it one more pass.',
    'Play 4-on-4 live, with a point for every catch-and-shoot attempt.',
  ],
};
