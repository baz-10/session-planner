import type { DrillAnimation } from '../types';

// Half court, attacking the right-hand hoop. The defender starts under the basket with the ball,
// passes out to a shooter on the wing and closes out. Three reps from the same spots:
//   rep 1 (tau 0-4.5):   good closeout, contest the shot, box out.
//   rep 2 (tau 10-14.4): good closeout, shooter drives, defender slides and cuts off the baseline.
//   rep 3 (tau 20-24.8): fly-by. Full speed, no chop; the shooter shot-fakes and drives past. Shown at 0.6x.
const SETUP = 3.5;
const R1 = { freeze: 2.2, hold: 3 };
const R3 = { start: 19, rate: 0.6 };
const t1 = (tau: number) => (tau <= R1.freeze ? SETUP + tau : SETUP + tau + R1.hold);
const t2 = (tau: number) => 12.5 + (tau - 10);
const t3 = (tau: number) => R3.start + (tau - 20) / R3.rate;
const LENGTH = t3(24.8) + 3;

export const closeouts: DrillAnimation = {
  slug: 'closeouts',
  name: 'Closeouts',
  category: 'Defence',
  summary:
    'Sprint, chop, high hand. The defender passes out, closes out under control, and either contests the shot or slides to cut off the drive.',
  level: 'Beginner',
  playerCount: '2+ (pairs, in two lines)',
  time: '6-8 min',
  equipment: 'Half court, 1 ball per pair',
  focus: ['Closeouts', 'Defensive stance', 'Containing the drive', 'Boxing out'],
  court: 'half',
  length: LENGTH,
  poster: 2.2,
  clock: [
    [0, 0],
    [SETUP, 0],
    [t1(R1.freeze), R1.freeze],
    [t1(R1.freeze) + R1.hold, R1.freeze],
    [t1(4.5), 4.5],
    [t1(4.5), 10],
    [12.5, 10],
    [t2(14.4), 14.4],
    [17.5, 14.4],
    [17.5, 20],
    [R3.start, 20],
    [t3(24.8), 24.8],
    [LENGTH, 24.8],
  ],
  players: [
    { id: 'X1', team: 'defense', label: 'X1', enterAt: 0.2, name: 'Defender' },
    { id: 'O1', team: 'offense', label: '1', enterAt: 0.4, name: 'Shooter' },
  ],
  tracks: {
    X1: [
      [0, 85, 27], [0.8, 85, 27], [1.6, 79.5, 36.5], [2.2, 77.3, 39.5], [2.9, 77.3, 39.5], [3.3, 78.3, 38.4], [3.8, 79.6, 36], [4.5, 79.6, 36],
      [9.5, 85, 27, 'jump'], [10.8, 85, 27], [11.6, 79.5, 36.5], [12.2, 77.3, 39.5], [12.6, 77.3, 39.5], [13.2, 80.4, 41.6], [13.8, 81.3, 42.2], [14.4, 81, 41.8],
      [19.5, 85, 27, 'jump'], [20.8, 85, 27], [21.75, 77.5, 38.5], [22.2, 73.5, 39.5], [22.5, 72.8, 39.6], [23.1, 77, 39.5], [23.8, 82, 34], [24.8, 83, 31.5],
    ],
    O1: [
      [0, 75, 42], [3.0, 75, 42], [3.5, 76.8, 40.2], [4.5, 77, 40],
      [9.5, 75, 42, 'jump'], [12.6, 75, 42], [13.2, 78.6, 44.6], [13.8, 79.3, 45], [14.4, 77.5, 44.5],
      [19.5, 75, 42, 'jump'], [22.1, 75, 42], [22.6, 79, 43.5], [23.2, 84, 38], [23.6, 86, 31.5], [24.8, 86.5, 30],
    ],
  },
  ball: [
    { type: 'hold', player: 'X1', start: 0, end: 0.8 },
    { type: 'pass', from: 'X1', to: 'O1', start: 0.8, end: 1.35 },
    { type: 'hold', player: 'O1', start: 1.35, end: 2.25 },
    { type: 'shot', player: 'O1', start: 2.25, end: 2.95, make: false },
    { type: 'rebound', to: 'X1', start: 2.95, end: 3.6 },
    { type: 'hold', player: 'X1', start: 3.6, end: 4.5 },
    { type: 'hold', player: 'X1', start: 9.5, end: 10.8 },
    { type: 'pass', from: 'X1', to: 'O1', start: 10.8, end: 11.35 },
    { type: 'hold', player: 'O1', start: 11.35, end: 14.4 },
    { type: 'hold', player: 'X1', start: 19.5, end: 20.8 },
    { type: 'pass', from: 'X1', to: 'O1', start: 20.8, end: 21.35 },
    { type: 'hold', player: 'O1', start: 21.35, end: 23.6 },
    { type: 'shot', player: 'O1', start: 23.6, end: 24.1 },
  ],
  arrows: [
    { show: 1.0, hide: t1(R1.freeze), from: 0.8, to: 2.2, players: ['X1'], passes: true },
    { show: t2(12.6) - 0.3, hide: t2(14.4), from: 12.6, to: 13.8, players: ['O1', 'X1'] },
    { show: t3(22.0), hide: t3(24.4), from: 22.0, to: 24.1, players: ['O1'], passes: true },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Pass out, then close out',
      body: 'The defender starts under the basket with the ball, passes to the shooter on the wing, then closes out.',
      callout: { player: 'X1', text: 'Starts with the ball' },
    },
    {
      at: SETUP,
      chapter: 'Rep 1: contest the shot',
      title: 'Sprint the first two-thirds',
      body: 'Pass and go. Sprint hard while the ball is in the air.',
      callout: { player: 'X1', text: 'Sprint' },
    },
    {
      at: t1(R1.freeze),
      freeze: true,
      title: 'Chop your feet',
      body: 'Short, choppy steps for the last third. Weight back, one hand high at the shooter\'s eyes, arm\'s length away.',
      callout: { player: 'X1', text: 'Chop, high hand' },
    },
    {
      at: t1(R1.freeze) + R1.hold,
      title: 'Contest, then box out',
      body: 'Contest without jumping into the shooter, then find them and box out.',
      callout: { player: 'X1', text: 'Box out' },
    },
    {
      at: t1(4.5),
      chapter: 'Rep 2: contain the drive',
      title: 'Same closeout',
      body: 'This time the shooter drives instead of shooting.',
    },
    {
      at: t2(12.6),
      title: 'Slide and cut off the baseline',
      body: 'Because X1 arrived under control, they can slide with the drive and beat the shooter to the spot.',
      callout: { player: 'X1', text: 'Slide, cut it off' },
    },
    {
      at: t2(13.8),
      tone: 'success',
      title: 'Contained',
      body: 'The shooter has to pick up or pass back out.',
      callout: { player: 'O1', text: 'Nowhere to go' },
    },
    {
      at: 17.5,
      chapter: 'Rep 3: the fly-by',
      tone: 'warning',
      title: 'What not to do',
      body: 'Watch the defender sprint all the way with no chop. Slow motion.',
      callout: { player: 'X1', text: 'Full speed, no chop' },
    },
    {
      at: t3(21.5),
      tone: 'warning',
      title: 'Shot fake',
      body: 'The shooter pump-fakes as X1 arrives.',
      callout: { player: 'O1', text: 'Shot fake' },
      quiz: {
        prompt: 'X1 is sprinting at full speed with no chop. The shooter shot-fakes. Who wins this one?',
        answer: 'O1',
        choices: ['O1', 'X1'],
        explain: 'Out of control, the defender can\'t stop. They fly past and the shooter drives for an easy layup.',
      },
    },
    {
      at: t3(22.2),
      tone: 'warning',
      title: 'Flies past',
      body: 'X1 can\'t stop and runs straight past the shooter.',
      callout: { player: 'X1', text: 'Flies by' },
    },
    {
      at: t3(23.4),
      tone: 'warning',
      title: 'Easy layup',
      body: 'The defender can\'t recover once they\'ve flown past.',
      callout: { player: 'O1', text: 'Layup' },
    },
    {
      at: t3(24.8),
      chapter: 'Key rule',
      tone: 'success',
      title: 'Sprint, chop, high hand',
      body: 'Arrive under control: sprint two-thirds of the way, chop the last third, high hand up, ready to slide.',
    },
  ],
  marks: [
    { kind: 'ring', player: 'X1', from: t1(R1.freeze), to: t1(R1.freeze) + R1.hold },
    { kind: 'tag', player: 'X1', text: 'Under control', from: t1(R1.freeze) + 0.2, to: t1(R1.freeze) + R1.hold, tone: 'success' },
  ],
  setup: [
    'Two lines: defenders under the basket with a ball each, shooters on the wing.',
    'Work both wings and the corners once players have the footwork.',
  ],
  howItRuns: [
    'The defender passes to the shooter and closes out.',
    'Start with the shooter catching and holding, so the defender can practise the footwork.',
    'Then let the shooter choose: shoot, or shot-fake and drive.',
    'Defender plays it out: contest and box out, or slide and contain.',
    'Swap lines after each rep.',
  ],
  coachingPoints: [
    {
      title: 'The closeout',
      points: [
        'Sprint while the ball is in the air.',
        'Chop your feet for the last third. Short, quick steps.',
        'Hands high: one at the shooter\'s eyes.',
        'Finish at arm\'s length, slightly on the high side to push the drive baseline.',
      ],
    },
    {
      title: 'After the closeout',
      points: [
        'Don\'t leave your feet on a shot fake.',
        'On a drive, slide first: don\'t cross your feet.',
        'On a shot, contest, then find the shooter and box out.',
      ],
    },
  ],
  mistakes: [
    'Running all the way at full speed and flying past the shooter.',
    'Jumping at the shot fake.',
    'Closing out with hands down, so the shooter gets a clean look.',
    'Stopping too far away and giving up an open shot.',
  ],
  progressions: [
    'Add a second pass: the coach swings the ball and the defender closes out to a new spot.',
    'Play it live 1-on-1: the shooter has three dribbles to score.',
    'Make it a competition: one point for a stop, one for a score.',
    'Two defenders and two shooters: closeout plus help.',
  ],
};
