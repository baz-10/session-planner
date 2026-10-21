import type { DrillAnimation } from '../types';

// Full court. 11 players: three attack, two defend at each end, and two outlets wait on the sidelines
// (free-throw line extended) at each end. Drill time runs one and a half cycles:
//   0-4.2    A1-A3 attack right against B1/B2. A2 misses; B1 rebounds on the top side.
//   4.2-10.4 B1 outlets to C1; B1, C1 and C2 attack left against D1/D2. B1 scores.
//            Right end refills: A1 and A2 defend, A3 and B2 take the outlet spots.
//   10.4-    D1 grabs it out of the net and outlets to E1; D1, E1, E2 head right.
//            Left end refills: C1 and B1 defend, C2 and D2 take the outlet spots.
const TOP = -1.5;
const BOTTOM = 51.5;
const RUN = 8;
const FREEZE_TAU = 4.9;
const HOLD = 3.5;
const tAt = (tau: number) => (tau <= FREEZE_TAU ? RUN + tau : RUN + tau + HOLD);
const END_TAU = 14;
const LENGTH = tAt(END_TAU) + 3;

export const elevenManBreak: DrillAnimation = {
  slug: '11-man-break',
  name: '11-man break',
  category: 'Transition',
  summary:
    'A non-stop 3-on-2 fast-break drill. Rebound or score, outlet, and three players go the other way while the attackers refill the defence and outlet spots.',
  level: 'Intermediate',
  playerCount: '11 (works with 11-14)',
  time: '8-12 min',
  equipment: 'Full court, 1 ball',
  focus: ['Fast break', 'Outlet passing', 'Filling lanes', 'Conditioning'],
  court: 'full',
  length: LENGTH,
  poster: 7,
  clock: [
    [0, 0],
    [RUN, 0],
    [tAt(FREEZE_TAU), FREEZE_TAU],
    [tAt(FREEZE_TAU) + HOLD, FREEZE_TAU],
    [tAt(END_TAU), END_TAU],
    [LENGTH, END_TAU],
  ],
  camera: [
    [0, 47, 25, 105.6],
    [RUN + 0.2, 47, 25, 105.6],
    [RUN + 1.4, 'ball', 25, 86],
    [tAt(3.9), 'ball', 25, 86],
    [tAt(4.6), 47, 25, 105.6],
    [tAt(FREEZE_TAU) + HOLD, 47, 25, 105.6],
    [tAt(6.2), 'ball', 25, 86],
    [tAt(10.2), 'ball', 25, 86],
    [tAt(10.8), 47, 25, 105.6],
    [LENGTH, 47, 25, 105.6],
  ],
  phases: [
    { at: 0, offense: ['A1', 'A2', 'A3'], waiting: ['C1', 'C2', 'D1', 'D2', 'E1', 'E2'] },
    { at: 4.2, offense: ['B1', 'C1', 'C2'], waiting: ['A1', 'A2', 'A3', 'B2', 'E1', 'E2'] },
    { at: 10.4, offense: ['D1', 'E1', 'E2'], waiting: ['B1', 'B2', 'C1', 'C2', 'D2', 'A3'] },
  ],
  players: [
    { id: 'A1', team: 'offense', label: '1', name: 'Player 1', enterAt: 0.2 },
    { id: 'A2', team: 'offense', label: '2', name: 'Player 2', enterAt: 0.3 },
    { id: 'A3', team: 'offense', label: '3', name: 'Player 3', enterAt: 0.4 },
    { id: 'B1', team: 'defense', label: '4', name: 'Player 4', enterAt: 2.6 },
    { id: 'B2', team: 'defense', label: '5', name: 'Player 5', enterAt: 2.7 },
    { id: 'D1', team: 'defense', label: '6', name: 'Player 6', enterAt: 2.8 },
    { id: 'D2', team: 'defense', label: '7', name: 'Player 7', enterAt: 2.9 },
    { id: 'C1', team: 'defense', label: '8', name: 'Player 8', enterAt: 4.8 },
    { id: 'C2', team: 'defense', label: '9', name: 'Player 9', enterAt: 4.9 },
    { id: 'E1', team: 'defense', label: '10', name: 'Player 10', enterAt: 5.0 },
    { id: 'E2', team: 'defense', label: '11', name: 'Player 11', enterAt: 5.1 },
  ],
  tracks: {
    A1: [[0, 30, 25], [2.6, 66, 25], [3.0, 66, 25], [3.6, 69, 26], [4.4, 70, 25], [END_TAU, 70, 25]],
    A2: [[0, 32, 8], [2.4, 75, 8], [3.0, 77, 9], [4.0, 78, 11.5], [5.4, 86, 25], [END_TAU, 86, 25]],
    A3: [[0, 32, 42], [2.4, 75, 42], [3.2, 80, 38], [4.3, 79, 43], [5.4, 75, BOTTOM], [END_TAU, 75, BOTTOM]],
    B1: [
      [0, 70, 25], [2.0, 70, 25], [2.4, 68.5, 25], [2.8, 68.5, 25], [3.5, 80, 20.5], [3.8, 82, 21], [4.3, 82, 21],
      [5.0, 74, 12], [8.0, 22, 7], [9.45, 19, 9], [9.75, 13.5, 14], [10.2, 10, 18], [10.6, 8.5, 21], [11.5, 8, 25], [END_TAU, 8, 25],
    ],
    B2: [[0, 86, 25], [2.7, 86, 25], [3.4, 80, 12.5], [3.9, 80, 12.5], [5.0, 77, 4], [5.8, 75, TOP], [END_TAU, 75, TOP]],
    C1: [
      [0, 75, TOP], [3.9, 75, TOP], [4.5, 77, 3], [4.75, 77, 3], [5.6, 64, 14], [8.0, 29, 25], [8.3, 29, 25],
      [9.2, 27, 25], [11.0, 24, 25], [END_TAU, 24, 25],
    ],
    C2: [
      [0, 75, BOTTOM], [4.2, 75, BOTTOM], [5.2, 66, 44], [8.0, 21, 42], [8.75, 21, 42],
      [9.4, 24, 38], [10.4, 32, 22], [11.6, 25, 4], [12.2, 19, TOP], [END_TAU, 19, TOP],
    ],
    D1: [
      [0, 24, 25], [7.3, 24, 25], [7.7, 25.5, 25], [8.1, 25.5, 25], [8.8, 13, 27], [9.4, 11, 26.5], [10.6, 6.8, 24.5], [10.9, 7, 23.5],
      [12.4, 20, 10], [END_TAU, 55, 7],
    ],
    D2: [[0, 8, 25], [8.1, 8, 25], [8.8, 15, 38], [9.5, 14, 36.5], [10.8, 17, 46], [11.6, 19, BOTTOM], [END_TAU, 19, BOTTOM]],
    E1: [[0, 19, TOP], [10.5, 19, TOP], [11.0, 18, 3], [11.35, 18, 3], [12.4, 30, 15], [END_TAU, 55, 24]],
    E2: [[0, 19, BOTTOM], [10.6, 19, BOTTOM], [12.3, 28, 44], [END_TAU, 55, 43]],
  },
  ball: [
    { type: 'hold', player: 'A1', start: 0, end: 2.6 },
    { type: 'pass', from: 'A1', to: 'A2', start: 2.6, end: 3.0 },
    { type: 'hold', player: 'A2', start: 3.0, end: 3.2 },
    { type: 'shot', player: 'A2', start: 3.2, end: 3.8, make: false },
    { type: 'rebound', to: 'B1', start: 3.8, end: 4.2 },
    { type: 'hold', player: 'B1', start: 4.2, end: 4.3 },
    { type: 'pass', from: 'B1', to: 'C1', start: 4.3, end: 4.75 },
    { type: 'hold', player: 'C1', start: 4.75, end: 8.05 },
    { type: 'pass', from: 'C1', to: 'C2', start: 8.05, end: 8.5 },
    { type: 'hold', player: 'C2', start: 8.5, end: 8.75 },
    { type: 'pass', from: 'C2', to: 'B1', start: 8.75, end: 9.45 },
    { type: 'hold', player: 'B1', start: 9.45, end: 9.75 },
    { type: 'shot', player: 'B1', start: 9.75, end: 10.2, hoop: 'left' },
    { type: 'hold', player: 'D1', start: 10.6, end: 10.9 },
    { type: 'pass', from: 'D1', to: 'E1', start: 10.9, end: 11.35 },
    { type: 'hold', player: 'E1', start: 11.35, end: END_TAU },
  ],
  arrows: [
    { show: 6.4, hide: tAt(2.6), from: 0, to: 2.6, players: ['A1', 'A2', 'A3'] },
    { show: tAt(FREEZE_TAU) + 0.1, hide: tAt(8.0), from: 4.2, to: 8.0, players: ['C1', 'B1', 'C2'], passes: true },
    { show: tAt(FREEZE_TAU) + 0.9, hide: tAt(6.0), from: 4.9, to: 5.8, players: ['A2', 'A3', 'B2'] },
    { show: tAt(10.5), hide: tAt(END_TAU), from: 10.9, to: END_TAU, players: ['E1', 'D1', 'E2'], passes: true },
    { show: tAt(10.9), hide: tAt(END_TAU), from: 10.4, to: 12.2, players: ['C2', 'D2'] },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Three attack',
      body: 'Three attackers start near half court and attack the far basket.',
      callout: { player: 'A1', text: 'Attackers' },
    },
    {
      at: 2.6,
      title: 'Two defend at each end',
      body: 'Two defenders wait in tandem at each end of the court.',
      callout: { player: 'B1', text: 'Tandem' },
    },
    {
      at: 4.8,
      title: 'Two outlets at each end',
      body: 'Two outlet players stand on the sidelines at the free-throw line extended, at both ends.',
      callout: { player: 'C1', text: 'Outlet' },
    },
    {
      at: RUN,
      chapter: 'Possession 1',
      title: '3-on-2',
      body: 'Attack quickly: middle to the free-throw line, wings wide.',
      callout: { player: 'A1', text: 'Push it' },
    },
    {
      at: tAt(3.8),
      title: 'Rebound and outlet',
      body: 'B1 rebounds on the top side and outlets to the ball-side wing.',
      callout: { player: 'B1', text: 'Rebound' },
      quiz: {
        prompt: 'The shot is off and B1 is rebounding on the top side. Who gets the outlet pass?',
        answer: 'C1',
        choices: ['C1', 'C2', 'B2'],
        explain: 'Outlet to the ball-side wing (8, at the top). The rebounder and the other outlet then fill the lanes.',
      },
    },
    {
      at: tAt(FREEZE_TAU),
      freeze: true,
      title: 'Who goes where',
      body: 'The rebounder and both outlets attack. The three attackers stay: two defend this end, one fills an outlet spot. The other defender fills the last outlet spot.',
      callout: { player: 'A3', text: 'Fills an outlet spot' },
    },
    {
      at: tAt(FREEZE_TAU) + HOLD,
      chapter: 'Possession 2',
      title: 'Three go the other way',
      body: 'The outlet pushes the ball up the middle; the rebounder and the other outlet sprint the wings.',
      callout: { player: 'C1', text: 'Push the middle' },
    },
    {
      at: tAt(8.0),
      title: 'Make the defence commit',
      body: 'Stop at the free-throw line, draw the top defender, and move it.',
      callout: { player: 'C1', text: 'Stop, pass' },
    },
    {
      at: tAt(10.2),
      tone: 'success',
      title: 'Score',
      body: 'Skip pass to the weak side and a layup.',
      callout: { player: 'B1', text: 'Layup' },
    },
    {
      at: tAt(10.5),
      chapter: 'Possession 3',
      title: 'And it never stops',
      body: 'A defender grabs it out of the net and outlets. Those three attack the other end.',
      callout: { player: 'D1', text: 'Grab it and outlet' },
    },
    {
      at: tAt(11.6),
      title: 'Refill the spots',
      body: '4 and 8 stay to defend this end. 9 and 7 fill the empty outlet spots.',
      callout: { player: 'C2', text: 'To the outlet spot' },
    },
  ],
  marks: [
    { kind: 'link', a: 'B1', b: 'B2', text: 'Tandem', from: 2.8, to: RUN },
    { kind: 'link', a: 'D1', b: 'D2', text: 'Tandem', from: 3.0, to: RUN },
    { kind: 'tag', player: 'C1', text: 'Outlet', from: 5.0, to: RUN },
    { kind: 'tag', player: 'C2', text: 'Outlet', from: 5.1, to: RUN },
    { kind: 'tag', player: 'E1', text: 'Outlet', from: 5.2, to: RUN },
    { kind: 'tag', player: 'E2', text: 'Outlet', from: 5.3, to: RUN },
    { kind: 'tag', player: 'A1', text: 'Defend', from: tAt(FREEZE_TAU) + 0.2, to: tAt(FREEZE_TAU) + HOLD },
    { kind: 'tag', player: 'A2', text: 'Defend', from: tAt(FREEZE_TAU) + 0.4, to: tAt(FREEZE_TAU) + HOLD },
    { kind: 'tag', player: 'A3', text: 'Outlet', from: tAt(FREEZE_TAU) + 0.6, to: tAt(FREEZE_TAU) + HOLD, tone: 'warning' },
    { kind: 'tag', player: 'B2', text: 'Outlet', from: tAt(FREEZE_TAU) + 0.8, to: tAt(FREEZE_TAU) + HOLD, tone: 'warning' },
  ],
  setup: [
    'Three attackers at half court with a ball.',
    'Two defenders in tandem at each end: one at the free-throw line, one under the basket.',
    'Two outlet players at each end, on the sidelines at the free-throw line extended.',
  ],
  howItRuns: [
    'The three attack 3-on-2.',
    'On a rebound or a score, a defender gets the ball and outlets to the ball-side outlet.',
    'The rebounder and both outlets attack the other end 3-on-2.',
    'The three attackers stay: two become the new defenders, one fills an outlet spot. The other defender fills the last outlet spot.',
    'Keep it going for a set time or a number of scores.',
  ],
  coachingPoints: [
    {
      title: 'Attack',
      points: [
        'The outlet catches facing up the floor and pushes to the middle.',
        'Wings sprint wide and stay ahead of the ball.',
        'Stop at the free-throw line and make the top defender commit.',
        'Two passes, then score.',
      ],
    },
    {
      title: 'Transition',
      points: [
        'Rebound, chin the ball, then outlet. No dribbling out of the paint.',
        'Outlets call for the ball and show a target hand.',
        'Attackers sprint to the empty spots straight away; the next break is coming.',
      ],
    },
  ],
  mistakes: [
    'Outlets drifting off their spot, so the rebounder has nobody to pass to.',
    'Dribbling the ball up instead of passing ahead.',
    'Attackers standing around after the shot instead of filling the spots.',
    'Everyone crowding the middle lane.',
  ],
  progressions: [
    'No dribbles allowed for the outlet: pass ahead only.',
    'Count scores in two minutes and try to beat the record.',
    'Add a trailing defender, like the 3-on-2 +1.',
    'Finish with a jump shot instead of a layup.',
  ],
};
