import type { DrillAnimation } from '../types';

// Half court, attacking the right-hand hoop. Two reps of the same high ball screen:
//   rep 1 (tau 0-7):   X5 hedges out on the ball, so the roll man is open.
//   rep 2 (tau 9.5-):  X5 drops to protect the rim, so the pull-up is open.
// Players start each rep on the same spots: 1 at the top, 5 on the right block, 2 spotted up in the far corner.

// Rep 1 clock: setup, run, freeze on the read, finish.
const A = { run: 5, freeze: 3.9, hold: 3.5 };
const tA = (tau: number) => (tau <= A.freeze ? A.run + tau : A.run + tau + A.hold);
// Rep 2 clock: starts at tau 9.6 after a short intro.
const B = { start: 15, intro: 2.5, tau0: 9.6, freeze: 13.8, hold: 3.5 };
const tB = (tau: number) => {
  const run = B.start + B.intro + (tau - B.tau0);
  return tau <= B.freeze ? run : run + B.hold;
};
const LENGTH = tB(16) + 3;

export const pickAndRoll: DrillAnimation = {
  slug: 'pick-and-roll',
  name: 'Pick and roll basics',
  category: 'Offence',
  summary:
    'The most common action in basketball. Set a good screen, use it properly, and read one defender: if the big jumps out, hit the roll; if the big drops, pull up.',
  level: 'Beginner to intermediate',
  playerCount: '4-6 (2-on-2 plus a corner shooter)',
  time: '10-12 min',
  equipment: 'Half court, 1 ball',
  focus: ['Ball screens', 'Reads', 'Passing', 'Screening'],
  court: 'half',
  length: LENGTH,
  poster: 4.6,
  clock: [
    [0, 0],
    [A.run, 0],
    [tA(A.freeze), A.freeze],
    [tA(A.freeze) + A.hold, A.freeze],
    [B.start, 7],
    [B.start, B.tau0],
    [B.start + B.intro, B.tau0],
    [tB(B.freeze), B.freeze],
    [tB(B.freeze) + B.hold, B.freeze],
    [tB(16), 16],
    [LENGTH, 16],
  ],
  players: [
    { id: 'O1', team: 'offense', label: '1', enterAt: 0.2 },
    { id: 'O5', team: 'offense', label: '5', enterAt: 0.35 },
    { id: 'O2', team: 'offense', label: '2', enterAt: 0.5 },
    { id: 'X1', team: 'defense', label: 'X1', enterAt: 0.8 },
    { id: 'X5', team: 'defense', label: 'X5', enterAt: 0.95 },
    { id: 'X2', team: 'defense', label: 'X2', enterAt: 1.1 },
  ],
  tracks: {
    O1: [
      [0, 60.8, 24], [1.4, 60.8, 24], [1.8, 59.8, 21.5], [2.2, 61.5, 23.5], [2.9, 65.5, 30], [3.6, 70, 32], [3.9, 71, 32], [4.6, 72, 31], [7, 72, 31],
      [9.5, 60.8, 24, 'jump'], [11.4, 60.8, 24], [11.8, 59.8, 21.5], [12.2, 61.5, 23.5], [12.9, 65.5, 30], [13.6, 69.5, 31.5], [13.9, 70.5, 31.5], [16, 70.5, 31.5],
    ],
    X1: [
      [0, 64.5, 24], [1.4, 64.5, 24], [1.8, 64, 22.5], [2.2, 64.6, 24.2], [2.9, 65.4, 25], [3.4, 66.5, 25.8], [3.9, 68.5, 28.5], [4.6, 70, 30], [7, 70, 30],
      [9.5, 64.5, 24, 'jump'], [11.4, 64.5, 24], [11.8, 64, 22.5], [12.2, 64.6, 24.2], [12.9, 65.4, 25], [13.1, 63.6, 26.4], [13.35, 63.4, 29.4], [13.7, 66.4, 31.4], [14.2, 68.3, 30.4], [16, 68.3, 30.4],
    ],
    O5: [
      [0, 79, 32], [1.0, 79, 32], [1.9, 66.2, 27.2], [3.1, 66.2, 27.2], [3.5, 68.5, 27.8], [4.3, 79, 26.5], [4.75, 83, 26], [5.3, 86, 26], [7, 85.5, 26.5],
      [9.5, 79, 32, 'jump'], [11, 79, 32], [11.9, 66.2, 27.2], [13.1, 66.2, 27.2], [13.5, 68.5, 27.8], [14.3, 74, 27], [16, 74.5, 27],
    ],
    X5: [
      [0, 82, 30], [1.0, 82, 30], [1.9, 69, 29], [2.6, 69.5, 31.5], [3.3, 72.5, 33.5], [3.9, 74, 34], [4.6, 78, 30], [5.3, 82.5, 28.5], [7, 82.5, 28.5],
      [9.5, 82, 30, 'jump'], [11, 82, 30], [11.9, 74.5, 28.5], [13.1, 74.5, 28.5], [13.9, 77.5, 28], [16, 79, 28],
    ],
    O2: [[0, 86, 4.5], [16, 86, 4.5]],
    X2: [[0, 82, 9], [3.6, 82, 9], [4.3, 81, 12], [6, 81, 12], [9.5, 82, 9, 'jump'], [16, 82, 9]],
  },
  ball: [
    { type: 'hold', player: 'O1', start: 0, end: 4.0, dribble: 'always' },
    { type: 'pass', from: 'O1', to: 'O5', start: 4.0, end: 4.4, style: 'bounce' },
    { type: 'hold', player: 'O5', start: 4.4, end: 4.75 },
    { type: 'shot', player: 'O5', start: 4.75, end: 5.25 },
    { type: 'hold', player: 'O1', start: 9.5, end: 13.9, dribble: 'always' },
    { type: 'shot', player: 'O1', start: 13.9, end: 14.6 },
  ],
  arrows: [
    { show: 2.2, hide: tA(A.freeze), from: 1.0, to: 3.1, players: ['O5'], screens: ['O5'] },
    { show: 5.4, hide: tA(A.freeze), from: 1.4, to: 3.9, players: ['O1'] },
    { show: tA(A.freeze) + 0.1, hide: tA(4.6), from: 3.1, to: 4.4, players: ['O5'], passes: true },
    { show: B.start + 0.4, hide: tB(B.freeze), from: 11.0, to: 13.1, players: ['O5'], screens: ['O5'] },
    { show: B.start + 0.9, hide: tB(B.freeze), from: 11.0, to: 13.9, players: ['X5'] },
    { show: tB(B.freeze) + 0.1, hide: tB(14.6) + 0.3, from: 13.85, to: 14.6, passes: true },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Ball handler and screener',
      body: '1 has the ball at the top. 5 is the screener. X1 and X5 guard them, and 2 spots up in the far corner.',
      callout: { player: 'O1', text: 'Ball handler' },
    },
    {
      at: 2.2,
      title: 'Set the screen',
      body: '5 sprints up and sets the screen on X1\'s hip: feet wide, arms in, and still. A moving screen is a foul.',
      callout: { player: 'O5', text: 'Screener' },
    },
    {
      at: A.run,
      chapter: 'Rep 1: the big jumps out',
      title: 'Set up the screen',
      body: '1 jabs the other way first, then comes off the screen shoulder to shoulder so X1 can\'t squeeze through.',
      callout: { player: 'O1', text: 'Jab, then go' },
    },
    {
      at: tA(2.6),
      tone: 'warning',
      title: 'X5 hedges',
      body: 'The screener\'s defender jumps out to stop the ball.',
      callout: { player: 'X5', text: 'Hedge' },
    },
    {
      at: tA(A.freeze),
      freeze: true,
      title: 'Hit the roll',
      body: 'X5 has left the screener to stop the ball. 5 rolls hard to the rim, and 1 hits them with a bounce pass.',
      callout: { player: 'O5', text: 'Rolling to the rim' },
      quiz: {
        prompt: 'X5 jumped out to stop the ball. Who is open?',
        answer: 'O5',
        choices: ['O1', 'O5', 'O2'],
        explain: 'When the big defender commits to the ball, the screener is open rolling to the rim. Bounce pass to 5.',
      },
    },
    {
      at: tA(A.freeze) + A.hold,
      tone: 'success',
      title: 'Layup',
      body: 'Bounce pass under the hedge, and 5 finishes before X5 can recover.',
      callout: { player: 'O5', text: 'Finish' },
    },
    {
      at: B.start,
      chapter: 'Rep 2: the big drops',
      tone: 'warning',
      title: 'Same action, different defence',
      body: 'This time X5 drops back toward the paint to protect the rim.',
    },
    {
      at: tB(11.9),
      title: 'X5 drops',
      body: 'X5 stays between the roller and the basket instead of stepping up.',
      callout: { player: 'X5', text: 'Drop' },
    },
    {
      at: tB(B.freeze),
      freeze: true,
      title: 'Pull up in the gap',
      body: 'X5 is back protecting the rim and X1 is trailing behind. The open shot is the pull-up at the elbow.',
      callout: { player: 'O1', text: 'Pull-up' },
      quiz: {
        prompt: 'X5 dropped back to protect the rim. Who has the best shot?',
        answer: 'O1',
        choices: ['O1', 'O5', 'O2'],
        explain: 'With the big defender sitting back and X1 trailing, 1 has space for a pull-up jumper.',
      },
    },
    {
      at: tB(B.freeze) + B.hold,
      tone: 'success',
      title: 'Knock it down',
      body: 'Rise straight up, square to the rim.',
      callout: { player: 'O1', text: 'Shoot it' },
    },
    {
      at: tB(16),
      chapter: 'Key read',
      tone: 'success',
      title: 'Read the big defender',
      body: 'Big jumps out: hit the roll. Big drops: pull up. That one read covers most pick and rolls.',
    },
  ],
  marks: [
    { kind: 'screen', player: 'O5', on: 'X1', from: tA(1.9), to: tA(3.1) },
    { kind: 'tag', player: 'X5', text: 'Hedge', from: tA(2.7), to: tA(4.6), tone: 'warning' },
    { kind: 'tag', player: 'O5', text: 'Roll', from: tA(A.freeze) + 0.3, to: tA(4.4) },
    { kind: 'screen', player: 'O5', on: 'X1', from: tB(11.9), to: tB(13.1) },
    { kind: 'tag', player: 'X5', text: 'Drop', from: tB(11.9), to: tB(14.6) },
    { kind: 'tag', player: 'X1', text: 'Trailing', from: tB(13.2), to: tB(14.6), tone: 'warning' },
  ],
  setup: [
    'Ball handler (1) at the top of the key, screener (5) on the block.',
    'A defender on each, plus a shooter (2) and defender in the far corner.',
    'Start at half speed so everyone learns the footwork, then go live.',
  ],
  howItRuns: [
    '5 sprints up and sets a ball screen on 1\'s defender.',
    '1 jabs away, then comes off the screen shoulder to shoulder.',
    'The coach tells X5 to hedge or drop. The offence reads it: hit the roll, or pull up.',
    'Rotate: offence to defence, defence to the back of the line.',
  ],
  coachingPoints: [
    {
      title: 'Ball handler',
      points: [
        'Set up your defender with a jab or a hesitation away from the screen.',
        'Wait for the screen to be set before you go.',
        'Come off shoulder to shoulder so your defender can\'t slip between you.',
        'Read the big defender, not your own.',
      ],
    },
    {
      title: 'Screener',
      points: [
        'Sprint into the screen, then stop: feet wide, arms in, knees bent.',
        'Angle the screen so the ball handler can attack the middle.',
        'Roll as soon as your guard is past, eyes on the ball, hands ready.',
        'If your defender drops, you can pop out for a shot instead.',
      ],
    },
  ],
  mistakes: [
    'Moving screens: the screener is still shuffling when contact happens.',
    'Going too early, before the screen is set.',
    'Leaving a gap, so the defender slips between ball handler and screener.',
    'Screener jogging the roll or not showing their hands.',
  ],
  progressions: [
    'Add the corner defender helping on the roll, so 1 must hit the corner shooter.',
    'Let the defence choose hedge or drop without telling the offence.',
    'Add a second side: screen, then reject the screen and go the other way.',
    'Play 3-on-3 live to 5 points, pick and roll only.',
  ],
};
