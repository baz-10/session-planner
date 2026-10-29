import type { DrillAnimation } from '../types';

// 2-on-1 continuous. Full court. Drill time (tau):
//   0-4.25    A1 and A2 attack right against D1. D1 stops the ball; A1 passes to A2 for a layup.
//   4.25-10.6 D1 grabs it out of the net and attacks left with W1 (the next player in line).
//             A1 sprints back to defend the left end; A2 joins the back of the line.
// The waiting line stands on the near sideline at the right end.
const LINE = 52;
const RUN = 7;
// Two coaching freezes: before the first pass, and when A1 stops the ball at the other end.
const tAt = (tau: number) => (tau <= 3 ? RUN + tau : tau <= 8.6 ? RUN + 3 + tau : RUN + 5.5 + tau);
const END_TAU = 10.6;
const LENGTH = tAt(END_TAU) + 3.9;

export const twoOnOne: DrillAnimation = {
  slug: '2-on-1-continuous',
  name: '2-on-1 continuous',
  category: 'Transition',
  summary:
    'Two attack one, end to end. The defender stops the ball and fakes at the pass; the attackers stay wide and score early. Then the defender and the next player go the other way.',
  level: 'Beginner',
  playerCount: '5+ (one line)',
  time: '6-10 min',
  equipment: 'Full court, 1 ball',
  focus: ['Fast break', 'Passing on the move', 'Defending outnumbered', 'Conditioning'],
  court: 'full',
  length: LENGTH,
  poster: 5.2,
  clock: [
    [0, 0],
    [RUN, 0],
    [tAt(3), 3],
    [tAt(3) + 3, 3],
    [tAt(8.6), 8.6],
    [tAt(8.6) + 2.5, 8.6],
    [tAt(END_TAU), END_TAU],
    [LENGTH, END_TAU],
  ],
  camera: [
    [0, 47, 25, 105.6],
    [RUN + 0.2, 47, 25, 105.6],
    [RUN + 1.4, 'ball', 25, 84],
    [tAt(4.1), 'ball', 25, 84],
    [tAt(4.8), 'ball', 25, 94],
    [tAt(6.4), 'ball', 25, 84],
    [tAt(END_TAU) - 0.2, 'ball', 25, 84],
    [tAt(END_TAU) + 1.2, 47, 25, 105.6],
    [LENGTH, 47, 25, 105.6],
  ],
  phases: [
    { at: 0, offense: ['A1', 'A2'], waiting: ['W1', 'W2'] },
    { at: 4.25, offense: ['D1', 'W1'], waiting: ['A2', 'W2'] },
  ],
  players: [
    { id: 'A1', team: 'offense', label: '1', name: 'Player 1', enterAt: 0.2 },
    { id: 'A2', team: 'offense', label: '2', name: 'Player 2', enterAt: 0.35 },
    { id: 'D1', team: 'defense', label: '3', name: 'Player 3', enterAt: 2.5 },
    { id: 'W1', team: 'defense', label: '4', name: 'Player 4', enterAt: 4.5 },
    { id: 'W2', team: 'defense', label: '5', name: 'Player 5', enterAt: 4.65 },
  ],
  tracks: {
    A1: [
      [0, 20, 20], [3.0, 66, 22], [3.6, 67, 22], [4.3, 67, 22], [7.2, 14, 25], [7.8, 11, 25], [8.5, 22.5, 25.5],
      [9.0, 20, 29], [9.6, 13, 29], [END_TAU, 13, 29],
    ],
    A2: [
      [0, 20, 40], [3.0, 74, 42], [3.55, 79, 38], [3.9, 83.5, 32], [4.3, 86.5, 29], [5.2, 86, 40], [6.6, 85, LINE], [END_TAU, 85, LINE],
    ],
    D1: [
      [0, 84, 25], [1.6, 84, 25], [2.6, 70.5, 23.5], [3.0, 70.5, 23.5], [3.3, 72.5, 25.5], [3.9, 80, 30], [4.3, 84.5, 26.5],
      [4.7, 87, 25], [8.6, 27, 26], [9.4, 22, 23], [END_TAU, 20, 22],
    ],
    W1: [
      [0, 78, LINE], [4.5, 78, LINE], [5.5, 70, 44], [8.5, 24, 42], [9.15, 20, 40], [9.6, 12, 36], [10.0, 7.5, 31], [END_TAU, 7, 30],
    ],
    W2: [[0, 81.5, LINE], [5.0, 81.5, LINE], [5.8, 78, LINE], [END_TAU, 78, LINE]],
  },
  ball: [
    { type: 'hold', player: 'A1', start: 0, end: 3.1 },
    { type: 'pass', from: 'A1', to: 'A2', start: 3.1, end: 3.55 },
    { type: 'hold', player: 'A2', start: 3.55, end: 3.75 },
    { type: 'shot', player: 'A2', start: 3.75, end: 4.25, hoop: 'right' },
    { type: 'rebound', to: 'D1', start: 4.25, end: 4.7, hoop: 'right' },
    { type: 'hold', player: 'D1', start: 4.7, end: 8.7 },
    { type: 'pass', from: 'D1', to: 'W1', start: 8.7, end: 9.15 },
    { type: 'hold', player: 'W1', start: 9.15, end: 9.75 },
    { type: 'shot', player: 'W1', start: 9.75, end: 10.25, hoop: 'left' },
  ],
  arrows: [
    { show: 4.6, hide: tAt(3), from: 0, to: 3.0, players: ['A1', 'A2'] },
    { show: tAt(3) + 0.1, hide: tAt(4.2), from: 3.0, to: 4.25, players: ['A2'], passes: true },
    { show: tAt(4.3), hide: tAt(8.6), from: 4.3, to: 8.6, players: ['D1', 'W1', 'A1'] },
    { show: tAt(8.6) + 0.1, hide: tAt(10.2), from: 8.6, to: 10.25, players: ['W1'], passes: true },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Two attack one',
      body: 'Two attackers start at one end with the ball, one in the middle and one wide.',
      callout: { player: 'A1', text: 'Attackers' },
    },
    {
      at: 2.5,
      title: 'One defender',
      body: 'One defender starts under the far basket.',
      callout: { player: 'D1', text: 'Defender' },
    },
    {
      at: 4.5,
      title: 'The next player waits',
      body: 'The rest of the group lines up on the sideline at the far end. The front player goes next.',
      callout: { player: 'W1', text: 'Next in' },
    },
    {
      at: RUN,
      chapter: 'Rep 1',
      title: 'Attack the defender',
      body: 'The ball handler drives straight at the defender. The partner sprints wide and stays level with the ball.',
      callout: { player: 'A1', text: 'Attack the basket' },
    },
    {
      at: tAt(2.2),
      title: 'Stop the ball',
      body: 'The defender steps up to the free-throw line to stop the ball, then fakes at the passing lane.',
      callout: { player: 'D1', text: 'Stop the ball' },
    },
    {
      at: tAt(3),
      freeze: true,
      title: 'The defender has committed',
      body: 'Once the defender steps up to the ball, the wide player is open. Pass early, before the defender can recover.',
      callout: { player: 'A2', text: 'Open' },
      quiz: {
        prompt: 'The defender has stepped up to stop the ball. Who is open?',
        answer: 'A2',
        choices: ['A1', 'A2'],
        explain: 'Player 2 stayed wide and level, so the pass is open for an easy layup. Make it early, before the defender recovers.',
      },
    },
    {
      at: tAt(3) + 3,
      title: 'Catch and finish',
      body: 'Catch on the move and lay it in. No extra dribbles.',
      callout: { player: 'A2', text: 'Layup' },
    },
    {
      at: tAt(4.25),
      chapter: 'Rep 2: the other way',
      tone: 'success',
      title: 'Score: go the other way',
      body: 'The defender grabs it out of the net and attacks with the next player. The scorer joins the back of the line.',
      callout: { player: 'D1', text: 'Grab it and go' },
    },
    {
      at: tAt(5),
      tone: 'warning',
      title: 'Sprint back',
      body: 'The other attacker turns and sprints back to defend the far end.',
      callout: { player: 'A1', text: 'Sprint back on defence' },
    },
    {
      at: tAt(8.6),
      freeze: true,
      title: 'Same read, other end',
      body: 'The new defender stops the ball and fakes at the pass. The wide player stays level and is ready for the pass.',
      callout: { player: 'A1', text: 'Stop the ball, fake the pass' },
    },
    {
      at: tAt(9.75),
      tone: 'success',
      title: 'Layup',
      body: 'Early pass, easy finish.',
      callout: { player: 'W1', text: 'Finish' },
    },
    {
      at: tAt(END_TAU),
      chapter: 'The cycle',
      tone: 'success',
      title: 'And it keeps going',
      body: 'After every score or stop, the defender and the next player in line attack the other way against one of the old attackers.',
    },
  ],
  marks: [
    { kind: 'tag', player: 'W1', text: 'Next', from: 4.7, to: RUN },
    { kind: 'tag', player: 'D1', text: 'Stop the ball', from: tAt(2.4), to: tAt(3) },
    { kind: 'tag', player: 'A2', text: 'Stay wide', from: RUN + 0.6, to: tAt(2.2) },
    { kind: 'tag', player: 'A2', text: 'To the line', from: tAt(4.6), to: tAt(6.6) },
  ],
  setup: [
    'One line of players on the sideline at one end.',
    'Two attackers start at the other end with a ball. One defender waits under the far basket.',
  ],
  howItRuns: [
    'The two attackers go 2-on-1 at the far basket.',
    'On a score or a stop, the defender and the next player in line attack the other way.',
    'One of the old attackers sprints back to defend. The other joins the back of the line.',
    'Keep it going for a set time.',
  ],
  coachingPoints: [
    {
      title: 'Attackers',
      points: [
        'Ball handler attacks the defender at speed.',
        'Partner stays wide and level with the ball, not behind it.',
        'Pass as soon as the defender commits. Score in one pass.',
      ],
    },
    {
      title: 'Defender',
      points: [
        'Get back to the paint first, then step up to stop the ball at the free-throw line.',
        'Fake at the passing lane to make the attackers hesitate.',
        'Make them make a pass. Don\'t give up a straight-line drive.',
      ],
    },
  ],
  mistakes: [
    'The wide player drifting behind the ball, so the pass is backwards.',
    'Passing too late, after the defender has recovered.',
    'The defender running out to the ball handler at half court and getting beaten.',
    'The old attacker jogging back on defence.',
  ],
  progressions: [
    'Limit the ball handler to three dribbles.',
    'Start the defender at half court so they have to sprint back.',
    'Add a second defender who joins late, like the 3-on-2 +1.',
  ],
};
