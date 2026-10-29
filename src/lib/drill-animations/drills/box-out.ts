import type { DrillAnimation, DrillKeyframe } from '../types';

// Half court, attacking the right-hand hoop. 3-on-3 around the key: 2 shoots from the top and misses.
//   rep 1 (tau 0-4.5):   every defender finds, hits and holds; X3 gets the rebound.
//   rep 2 (tau 10-14.6): X3 watches the ball instead, and 3 gets the offensive rebound and scores.
const SETUP = 4;
const R1 = { freeze: 2.5, hold: 2.5 };
const t1 = (tau: number) => (tau <= R1.freeze ? SETUP + tau : SETUP + tau + R1.hold);
const R2 = { start: 13, freeze: 12.5, hold: 3 };
const t2 = (tau: number) => (tau <= R2.freeze ? R2.start + (tau - 10) : R2.start + (tau - 10) + R2.hold);
const LENGTH = t2(14.6) + 3.4;

// Both reps start from the same spots, so rep 2 repeats rep 1's keys shifted by 10 s after a jump cut.
const rep = (keys: Array<[number, number, number]>, rep2: Array<[number, number, number]> = keys): DrillKeyframe[] => [
  ...keys,
  [9.5, rep2[0][1], rep2[0][2], 'jump'],
  ...rep2.map(([tau, x, y]): DrillKeyframe => [tau + 10, x, y]),
];

export const boxOut: DrillAnimation = {
  slug: 'box-out',
  name: 'Box out',
  category: 'Rebounding',
  summary:
    'Three-on-three rebounding. When the shot goes up, every defender finds their player, makes contact and holds them off before going to get the ball.',
  level: 'Beginner',
  playerCount: '6 (3 on 3)',
  time: '6-8 min',
  equipment: 'Half court, 1 ball',
  focus: ['Boxing out', 'Defensive rebounding', 'Contact', 'Effort'],
  court: 'half',
  length: LENGTH,
  poster: 2.4,
  clock: [
    [0, 0],
    [SETUP, 0],
    [t1(R1.freeze), R1.freeze],
    [t1(R1.freeze) + R1.hold, R1.freeze],
    [t1(4.5), 4.5],
    [t1(4.5), 10],
    [R2.start, 10],
    [t2(R2.freeze), R2.freeze],
    [t2(R2.freeze) + R2.hold, R2.freeze],
    [t2(14.6), 14.6],
    [LENGTH, 14.6],
  ],
  players: [
    { id: 'O1', team: 'offense', label: '1', enterAt: 0.2 },
    { id: 'O2', team: 'offense', label: '2', enterAt: 0.3 },
    { id: 'O3', team: 'offense', label: '3', enterAt: 0.4 },
    { id: 'X1', team: 'defense', label: 'X1', enterAt: 0.8 },
    { id: 'X2', team: 'defense', label: 'X2', enterAt: 0.9 },
    { id: 'X3', team: 'defense', label: 'X3', enterAt: 1.0 },
  ],
  tracks: {
    O1: rep([[0, 74, 8], [1.7, 74, 8], [2.5, 75.2, 9.3], [4.5, 75.2, 9.3]]),
    O2: rep([[0, 64, 25], [1.7, 64, 25], [2.5, 66.5, 25], [4.5, 66.5, 25]]),
    O3: rep(
      [[0, 74, 42], [1.7, 74, 42], [2.5, 75.2, 40.7], [4.5, 75.2, 40.7]],
      [[0, 74, 42], [1.7, 74, 42], [2.5, 80, 39.5], [3.1, 84, 34.5], [3.6, 84, 34.5], [4.0, 85.5, 31], [4.6, 85.5, 31]],
    ),
    X1: rep([[0, 77.5, 11.5], [1.2, 77.5, 11.5], [1.7, 76, 10.2], [2.5, 76.7, 10.6], [4.5, 76.7, 10.6]]),
    X2: rep([[0, 67.5, 25], [1.2, 67.5, 25], [1.7, 66.6, 25], [2.5, 68.5, 25], [4.5, 68.5, 25]]),
    X3: rep(
      [[0, 77.5, 38.5], [1.2, 77.5, 38.5], [1.7, 76, 39.8], [2.5, 76.7, 39.4], [2.7, 76.7, 39.4], [3.3, 82, 33], [4.5, 82, 33]],
      [[0, 77.5, 38.5], [1.2, 77.5, 38.5], [2.2, 80.5, 34.5], [4.6, 80.5, 34.5]],
    ),
  },
  ball: [
    { type: 'hold', player: 'O2', start: 0, end: 1.0, dribble: 'never' },
    { type: 'shot', player: 'O2', start: 1.0, end: 1.7, make: false },
    { type: 'rebound', to: 'X3', start: 2.7, end: 3.3 },
    { type: 'hold', player: 'X3', start: 3.3, end: 4.5, dribble: 'never' },
    { type: 'hold', player: 'O2', start: 9.5, end: 11.0, dribble: 'never' },
    { type: 'shot', player: 'O2', start: 11.0, end: 11.7, make: false },
    { type: 'rebound', to: 'O3', start: 12.6, end: 13.1 },
    { type: 'hold', player: 'O3', start: 13.1, end: 13.6, dribble: 'never' },
    { type: 'shot', player: 'O3', start: 13.6, end: 14.1 },
  ],
  arrows: [
    { show: t1(1.2), hide: t1(R1.freeze) + R1.hold, from: 1.2, to: 2.5, players: ['X1', 'X2', 'X3'] },
    { show: t1(R1.freeze) + 0.2, hide: t1(4.5), from: 2.6, to: 3.3, players: ['X3'] },
    { show: t2(11.7), hide: t2(14.1), from: 11.7, to: 13.1, players: ['O3'] },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Three on three',
      body: 'Three attackers on the perimeter, each with a defender. 2 shoots from the top of the key.',
      callout: { player: 'O2', text: 'Shooter' },
    },
    {
      at: 2.2,
      title: 'Defenders start between player and basket',
      body: 'Every defender is in the right spot before the shot goes up.',
      callout: { player: 'X2', text: 'Ball, you, basket' },
    },
    {
      at: SETUP,
      chapter: 'Rep 1: box out',
      title: 'Shot goes up',
      body: 'The moment the ball leaves the shooter\'s hands, every defender has a job.',
      callout: { player: 'O2', text: 'Shot' },
    },
    {
      at: t1(1.2),
      title: 'Find your player',
      body: 'Look for your player first, not the ball. Step towards them.',
      callout: { player: 'X1', text: 'Find' },
    },
    {
      at: t1(1.9),
      title: 'Hit: make contact first',
      body: 'Turn and put your back into their chest before they get going.',
      callout: { player: 'X3', text: 'Hit' },
    },
    {
      at: t1(R1.freeze),
      freeze: true,
      title: 'Hold them off',
      body: 'Wide base, low hips, elbows out. Keep your player behind you and feel where they go.',
      callout: { player: 'X2', text: 'Hold' },
    },
    {
      at: t1(2.6),
      tone: 'success',
      title: 'Get the ball',
      body: 'Once the ball comes off the rim, go and get it with two hands.',
      callout: { player: 'X3', text: 'Get it' },
    },
    {
      at: t1(4.5),
      chapter: 'Rep 2: ball watching',
      tone: 'warning',
      title: 'Same shot',
      body: 'Watch X3 this time.',
    },
    {
      at: t2(11.2),
      tone: 'warning',
      title: 'X3 watches the ball',
      body: 'X3 turns to look at the rim and never finds their player.',
      callout: { player: 'X3', text: 'Ball watching' },
    },
    {
      at: t2(R2.freeze),
      freeze: true,
      tone: 'warning',
      title: 'Who missed their box out?',
      body: 'X1 and X2 have made contact. X3 is standing in the paint with nobody on their back.',
      callout: { player: 'O3', text: 'Free run to the ball' },
      quiz: {
        prompt: 'The shot is in the air. Which defender didn\'t box out?',
        answer: 'X3',
        choices: ['X1', 'X2', 'X3'],
        explain: 'X3 watched the ball and never found 3, so 3 runs straight past for the rebound.',
      },
    },
    {
      at: t2(R2.freeze) + R2.hold,
      tone: 'warning',
      title: 'Offensive rebound',
      body: '3 runs past X3 and takes the rebound.',
      callout: { player: 'O3', text: 'Rebound' },
    },
    {
      at: t2(13.6),
      tone: 'warning',
      title: 'Second-chance points',
      body: 'One missed box out gives away an easy putback.',
      callout: { player: 'O3', text: 'Putback' },
    },
    {
      at: t2(14.6),
      chapter: 'Key rule',
      tone: 'success',
      title: 'Find, hit, get',
      body: 'Find your player, hit them first and hold, then go and get the ball.',
    },
  ],
  marks: [
    { kind: 'tag', player: 'X1', text: 'Box out', from: t1(R1.freeze) + 0.1, to: t1(R1.freeze) + R1.hold },
    { kind: 'tag', player: 'X2', text: 'Box out', from: t1(R1.freeze) + 0.2, to: t1(R1.freeze) + R1.hold },
    { kind: 'tag', player: 'X3', text: 'Box out', from: t1(R1.freeze) + 0.3, to: t1(R1.freeze) + R1.hold },
    { kind: 'link', a: 'X1', b: 'O1', from: t1(2.0), to: t1(R1.freeze) + R1.hold },
    { kind: 'link', a: 'X2', b: 'O2', from: t1(2.0), to: t1(R1.freeze) + R1.hold },
    { kind: 'link', a: 'X3', b: 'O3', from: t1(2.0), to: t1(R1.freeze) + R1.hold },
    { kind: 'ring', player: 'X3', from: t2(R2.freeze) + R2.hold, to: t2(14.6), tone: 'warning' },
  ],
  setup: [
    'Three attackers spread around the perimeter: two wings and the top of the key.',
    'Three defenders, each guarding one attacker.',
    'The coach, or the attacker at the top, has the ball.',
  ],
  howItRuns: [
    'The ball is shot, or the coach throws it off the backboard.',
    'Every defender finds their player, makes contact and holds them off.',
    'Defenders go and get the ball once it comes off the rim.',
    'Attackers try to get past for the offensive rebound. Play until the defence secures the ball.',
    'Rotate attackers to defence after each rep.',
  ],
  coachingPoints: [
    {
      title: 'Box out',
      points: [
        'Find your player before you look for the ball.',
        'Hit first: make contact before the attacker builds up speed.',
        'Wide base, low hips, elbows out, back into their chest.',
        'Hold for a count of one or two, then go and get the ball.',
      ],
    },
    {
      title: 'Rebound',
      points: [
        'Most misses land on the opposite side of the rim.',
        'Grab it with two hands and bring it under your chin.',
        'Call "ball!" so teammates know the rebound is safe.',
      ],
    },
  ],
  mistakes: [
    'Turning to watch the ball and losing your player.',
    'Waiting for the attacker to arrive instead of hitting first.',
    'Standing up tall, which lets the attacker push you under the rim.',
    'Holding too long and letting the ball bounce free.',
  ],
  progressions: [
    'Coach throws the ball off the backboard from different angles.',
    'Start defenders further away so they have to close out, then box out.',
    'Score it: one point for a defensive rebound, two for an offensive rebound.',
    'Go live: the rebounder outlets and the drill becomes a fast break.',
  ],
};
