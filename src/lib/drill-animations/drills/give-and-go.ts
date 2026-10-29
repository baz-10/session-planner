import type { DrillAnimation } from '../types';

// Half court, attacking the right-hand hoop. 2-on-2: a guard (1) and a wing (2).
// One full-speed rep (tau 0-6) with a freeze on the read, then a half-speed replay of the cut.
const SETUP = 4;
const READ_TAU = 2.5;
const HOLD = 3;
const tRun = (tau: number) => (tau <= READ_TAU ? SETUP + tau : SETUP + tau + HOLD);
const REPLAY = { at: tRun(6) + 0.4, from: 1.2, to: 4.6, rate: 0.5 };
const tReplay = (tau: number) => REPLAY.at + 0.6 + (tau - REPLAY.from) / REPLAY.rate;
const LENGTH = tReplay(REPLAY.to) + 3.2;

export const giveAndGo: DrillAnimation = {
  slug: 'give-and-go',
  name: 'Give and go',
  category: 'Offence',
  summary:
    'The simplest two-player action in basketball: pass to a teammate, cut hard to the rim in front of your defender, and get the ball straight back for a layup.',
  level: 'Beginner',
  playerCount: '4 (2-on-2), groups rotate',
  time: '6-8 min',
  equipment: 'Half court, 1 ball per group',
  focus: ['Cutting', 'Passing', 'Reading the defender', 'Finishing'],
  court: 'half',
  length: LENGTH,
  poster: 2.6,
  clock: [
    [0, 0],
    [SETUP, 0],
    [tRun(READ_TAU), READ_TAU],
    [tRun(READ_TAU) + HOLD, READ_TAU],
    [tRun(6), 6],
    [REPLAY.at, 6],
    [REPLAY.at, REPLAY.from],
    [tReplay(REPLAY.from), REPLAY.from],
    [tReplay(REPLAY.to), REPLAY.to],
    [LENGTH, REPLAY.to],
  ],
  players: [
    { id: 'O1', team: 'offense', label: '1', enterAt: 0.2, name: 'Guard (1)' },
    { id: 'O2', team: 'offense', label: '2', enterAt: 0.35, name: 'Wing (2)' },
    { id: 'X1', team: 'defense', label: 'X1', enterAt: 0.8 },
    { id: 'X2', team: 'defense', label: 'X2', enterAt: 0.95 },
  ],
  tracks: {
    O1: [
      [0, 64, 32], [1.7, 64, 32], [2.2, 62.5, 29.5], [2.5, 63.5, 31], [2.75, 65, 34], [3.1, 71, 35.5],
      [3.45, 79, 33.5], [3.9, 83.5, 30.5], [4.3, 85.5, 28.5], [4.8, 86.5, 27.5], [6, 86.5, 27.5],
    ],
    X1: [
      [0, 67, 31], [1.7, 67, 31], [2.2, 66, 30], [2.6, 66.5, 30.5], [3.0, 67, 31.5], [3.6, 72, 32],
      [4.5, 79, 30.5], [6, 79.5, 30],
    ],
    O2: [[0, 74, 44], [6, 74, 44]],
    X2: [[0, 76.5, 41.5], [3.3, 76.5, 41.5], [3.8, 77.5, 40], [6, 77.5, 40]],
  },
  ball: [
    { type: 'hold', player: 'O1', start: 0, end: 1.2, dribble: 'never' },
    { type: 'pass', from: 'O1', to: 'O2', start: 1.2, end: 1.7 },
    { type: 'hold', player: 'O2', start: 1.7, end: 3.45, dribble: 'never' },
    { type: 'pass', from: 'O2', to: 'O1', start: 3.45, end: 3.9, style: 'bounce' },
    { type: 'hold', player: 'O1', start: 3.9, end: 4.05 },
    { type: 'shot', player: 'O1', start: 4.05, end: 4.5 },
  ],
  arrows: [
    { show: SETUP + 0.3, hide: tRun(READ_TAU), from: 1.2, to: READ_TAU, players: ['O1'], passes: true },
    { show: tRun(READ_TAU) + 0.1, hide: tRun(4.6), from: READ_TAU, to: 4.5, players: ['O1'], passes: true },
    { show: REPLAY.at + 0.1, hide: tReplay(REPLAY.to), from: REPLAY.from, to: 4.5, players: ['O1'], passes: true },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Guard and wing',
      body: '1 has the ball at the top. 2 is on the wing. Each has a defender.',
      callout: { player: 'O1', text: 'Guard' },
    },
    {
      at: 2,
      title: 'Defenders in position',
      body: 'X1 guards the ball. X2 guards the wing, one pass away.',
      callout: { player: 'X1', text: 'On the ball' },
    },
    {
      at: SETUP,
      chapter: 'Full speed',
      title: 'Pass to the wing',
      body: '1 passes to 2 on the wing. That\'s the "give".',
      callout: { player: 'O1', text: 'Pass' },
    },
    {
      at: tRun(1.8),
      title: 'Jab step away',
      body: 'One hard step away from the ball sets up the cut.',
      callout: { player: 'O1', text: 'Jab away' },
    },
    {
      at: tRun(READ_TAU),
      freeze: true,
      tone: 'warning',
      title: 'Cut in front',
      body: 'X1 has turned to watch the pass. 1 cuts hard to the rim, between X1 and the ball.',
      callout: { player: 'O1', text: 'Cut in front of X1' },
      quiz: {
        prompt: 'X1 has turned to watch the pass. Who should cut to the rim now?',
        answer: 'O1',
        choices: ['O1', 'O2'],
        explain: 'The passer, 1. X1 is ball-watching, so 1 cuts in front of them and gets the ball straight back.',
      },
    },
    {
      at: tRun(READ_TAU) + HOLD,
      title: 'Give it back',
      body: '2 hits the cutter with a bounce pass. That\'s the "go".',
      callout: { player: 'O2', text: 'Bounce pass' },
    },
    {
      at: tRun(4.05),
      tone: 'success',
      title: 'Layup',
      body: '1 catches on the move and finishes before X1 can recover.',
      callout: { player: 'O1', text: 'Finish' },
    },
    {
      at: REPLAY.at,
      chapter: 'Slow motion',
      title: 'Watch the footwork',
      body: 'Half speed: the pass, the jab, then the cut.',
    },
    {
      at: tReplay(1.75),
      title: 'Pass and jab',
      body: 'Pass, then step away as if you\'re going to the other side.',
      callout: { player: 'O1', text: 'Jab' },
    },
    {
      at: tReplay(2.6),
      title: 'Cut ahead of the defender',
      body: 'Push off the jab foot and cut on the ball side of X1.',
      callout: { player: 'O1', text: 'Front cut' },
    },
    {
      at: tReplay(3.45),
      title: 'Show a target',
      body: 'Hand up as you cut, so the passer knows where to put it.',
      callout: { player: 'O1', text: 'Target hand' },
    },
    {
      at: tReplay(REPLAY.to),
      chapter: 'Key rule',
      tone: 'success',
      title: 'Pass and cut',
      body: 'If your defender watches the ball after you pass, cut in front of them to the rim.',
    },
  ],
  marks: [
    { kind: 'tag', player: 'X1', text: 'Watching the ball', from: tRun(READ_TAU) + 0.1, to: tRun(READ_TAU) + HOLD, tone: 'warning' },
    { kind: 'ring', player: 'O1', from: tRun(READ_TAU) + 0.1, to: tRun(READ_TAU) + HOLD },
  ],
  setup: [
    'Two lines: guards at the top of the key, wings on the wing.',
    'One defender on each attacker. Start with the ball at the top.',
  ],
  howItRuns: [
    'The guard passes to the wing.',
    'The guard jabs away, then cuts hard to the rim in front of their defender.',
    'The wing passes straight back, usually a bounce pass, for a layup.',
    'If the defender jumps to the ball, the guard cuts behind instead, or replaces themselves at the top.',
    'Rotate: offence to defence, defence to the back of the line.',
  ],
  coachingPoints: [
    {
      title: 'Cutter',
      points: [
        'Pass, then jab hard away to sell it.',
        'Cut in front of your defender, between them and the ball.',
        'Show a target hand and expect the ball.',
      ],
    },
    {
      title: 'Passer',
      points: [
        'Catch facing the basket so you can see the cut.',
        'Bounce pass under the defender\'s hands.',
        'Lead the cutter: pass to where they\'re going.',
      ],
    },
  ],
  mistakes: [
    'Cutting slowly, so the defender recovers.',
    'Cutting behind a defender who is watching the ball, which lets them stay between you and the pass.',
    'Passing late, after the cutter has reached the rim.',
  ],
  progressions: [
    'Defence chooses: watch the ball or jump to it. Offence reads it and cuts in front or behind.',
    'Add a third attacker who fills the spot the cutter left.',
    'Play live 2-on-2: first to three baskets.',
  ],
};
