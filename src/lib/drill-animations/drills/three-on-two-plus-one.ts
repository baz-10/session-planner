import type { DrillAnimation } from '../types';

// 3-on-2 +1 continuous, Dark vs Light. Each team lines up at its coaches box: Dark on the far
// sideline (y < 0), Light on the near sideline (y > 50). Drill time (tau) runs three possessions:
//   0-6.3    Dark attack right against a Light tandem; Light's +1 goes when the ball crosses half. Dark score.
//   6.3-12.2 Make it, take it: the same Dark three attack left against a fresh Light tandem and +1. Dark miss.
//   12.2-    Light rebound and attack right against a fresh Dark tandem; Dark's +1 goes at half court.
const DARK_LINE = -2;
const LIGHT_LINE = 52;

// Presentation clock: 9 s of setup, then real time with one coaching freeze at the first pass.
const RUN = 9;
const FREEZE_TAU = 3.9;
const FREEZE_FOR = 2.5;
const tAt = (tau: number) => (tau <= FREEZE_TAU ? RUN + tau : RUN + tau + FREEZE_FOR);
const END_TAU = 18.6;
const LENGTH = tAt(END_TAU) + 4;

export const threeOnTwoPlusOne: DrillAnimation = {
  slug: '3-on-2-plus-1',
  name: '3-on-2 +1 continuous',
  category: 'Transition',
  summary:
    'Dark vs Light, end to end. Three attack two, and the +1 must touch the centre circle before sprinting back once the ball crosses half. Score and go again; miss and the defence goes the other way.',
  level: 'Beginner to intermediate',
  playerCount: '10-14 (two teams)',
  time: '10-15 min',
  equipment: 'Full court, 1 ball, two sets of bibs',
  focus: ['Fast break', 'Decision making', 'Tandem defence', 'Transition', 'Conditioning'],
  court: 'full',
  length: LENGTH,
  poster: 7.2,
  clock: [
    [0, 0],
    [RUN, 0],
    [tAt(FREEZE_TAU), FREEZE_TAU],
    [tAt(FREEZE_TAU) + FREEZE_FOR, FREEZE_TAU],
    [tAt(END_TAU), END_TAU],
    [LENGTH, END_TAU],
  ],
  camera: [
    [0, 47, 25, 105.6],
    // Stay wide until the +1 has left the sideline, so the first quiz's answer is on screen.
    [tAt(2.9), 47, 25, 105.6],
    [tAt(3.8), 'ball', 25, 82],
    [tAt(6.0), 'ball', 25, 80],
    [tAt(6.6), 'ball', 25, 90],
    [tAt(8.4), 'ball', 25, 80],
    [tAt(11.9), 'ball', 25, 80],
    [tAt(12.4), 'ball', 25, 90],
    [tAt(14.4), 'ball', 25, 82],
    [tAt(END_TAU) - 0.3, 'ball', 25, 82],
    [tAt(END_TAU) + 1.2, 47, 25, 105.6],
    [LENGTH, 47, 25, 105.6],
  ],
  players: [
    { id: 'D1', team: 'offense', kit: 'dark', label: '1', enterAt: 0.2 },
    { id: 'D2', team: 'offense', kit: 'dark', label: '2', enterAt: 0.3 },
    { id: 'D3', team: 'offense', kit: 'dark', label: '3', enterAt: 0.4 },
    { id: 'D4', team: 'offense', kit: 'dark', label: '4', enterAt: 0.55 },
    { id: 'D5', team: 'offense', kit: 'dark', label: '5', enterAt: 0.65 },
    { id: 'D6', team: 'offense', kit: 'dark', label: '6', enterAt: 0.75 },
    { id: 'L1', team: 'defense', kit: 'light', label: '1', enterAt: 1.0 },
    { id: 'L2', team: 'defense', kit: 'light', label: '2', enterAt: 1.1 },
    { id: 'L3', team: 'defense', kit: 'light', label: '3', enterAt: 1.2 },
    { id: 'L4', team: 'defense', kit: 'light', label: '4', enterAt: 1.35 },
    { id: 'L5', team: 'defense', kit: 'light', label: '5', enterAt: 1.45 },
    { id: 'L6', team: 'defense', kit: 'light', label: '6', enterAt: 1.55 },
  ],
  tracks: {
    // ---- Dark ----
    D1: [
      [0, 6, 25], [3.9, 66, 25], [4.45, 66, 25], [5.2, 70, 24], [6.0, 72, 25],
      [6.9, 64, 36], [9.4, 34, 42], [10.5, 18, 41.5], [11.4, 17, 41], [12.2, 20, 37], [14.6, 41, 4], [15.4, 43.5, DARK_LINE],
    ],
    D2: [
      [0, 8, 7], [3.6, 75, 7], [4.4, 77, 9], [6.0, 77, 9],
      [6.6, 72, 8], [9.4, 34, 7], [10.5, 20, 7.5], [11.4, 15, 10], [12.2, 20, 10], [14.4, 45, 1], [15.2, 47, DARK_LINE],
    ],
    D3: [
      [0, 8, 43], [3.6, 75, 43], [4.4, 78, 42], [5.15, 84, 35], [5.6, 86.5, 30], [6.3, 88.3, 26.6],
      [6.7, 84, 26], [10.3, 29, 25], [10.5, 29, 25], [11.3, 24, 28], [12.0, 22, 29], [14.8, 48, 1], [15.5, 50.5, DARK_LINE],
    ],
    D4: [[0, 40, DARK_LINE], [12.0, 40, DARK_LINE], [14.8, 70, 25], [16.4, 70, 25], [16.9, 68, 25], [END_TAU, 68, 25]],
    D5: [[0, 43.5, DARK_LINE], [12.0, 43.5, DARK_LINE], [15.2, 86, 25], [END_TAU, 86, 25]],
    D6: [
      [0, 47, DARK_LINE], [12.4, 47, DARK_LINE], [13.2, 40, DARK_LINE], [15.15, 40, DARK_LINE],
      [16.25, 45, 19.6], [18.4, 76, 22], [END_TAU, 77, 22],
    ],
    // ---- Light ----
    L1: [
      [0, 70, 25], [2.9, 70, 25], [3.7, 68.5, 25], [4.05, 68.5, 25], [4.7, 76, 26], [5.4, 82, 30], [6.1, 84, 31], [6.5, 84, 31],
      [7.3, 78, 40], [9.7, 52, 51], [10.3, 50.5, LIGHT_LINE], [END_TAU, 50.5, LIGHT_LINE],
    ],
    L2: [
      [0, 86, 25], [4.0, 86, 25], [4.8, 79.5, 12], [5.4, 79, 13], [6.4, 80, 15],
      [7.6, 80, 15], [8.4, 74, 32], [10.6, 56, 51], [10.9, 54, LIGHT_LINE], [END_TAU, 54, LIGHT_LINE],
    ],
    L3: [
      [0, 47, LIGHT_LINE], [2.45, 47, LIGHT_LINE], [3.55, 47, 30.6], [6.3, 80, 30], [6.9, 83, 29],
      [7.7, 78, 38], [10.9, 59, 51], [11.5, 57.5, LIGHT_LINE], [END_TAU, 57.5, LIGHT_LINE],
    ],
    L4: [
      [0, 50.5, LIGHT_LINE], [6.3, 50.5, LIGHT_LINE], [8.8, 24, 25], [10.0, 23.5, 25], [10.4, 24.4, 25],
      [11.2, 12, 27], [11.85, 8, 25], [12.3, 9, 25], [16.5, 62, 25], [END_TAU, 62, 25],
    ],
    L5: [
      [0, 54, LIGHT_LINE], [5.6, 54, LIGHT_LINE], [8.8, 8, 25], [10.5, 8, 25], [11.3, 14.5, 37.5], [11.9, 13, 36],
      [12.4, 16, 40], [16.2, 66, 44], [17.0, 74, 43], [END_TAU, 75, 43],
    ],
    L6: [
      [0, 57.5, LIGHT_LINE], [6.3, 57.5, LIGHT_LINE], [7.2, 47, LIGHT_LINE], [8.9, 47, LIGHT_LINE], [10.0, 47, 30.6],
      [11.2, 28, 34], [12.1, 14, 30], [12.45, 15.5, 21], [13.0, 18, 15], [16.2, 66, 7], [17.0, 74, 7], [END_TAU, 75, 7],
    ],
  },
  ball: [
    { type: 'hold', player: 'D1', start: 0, end: 3.9 },
    { type: 'pass', from: 'D1', to: 'D2', start: 3.9, end: 4.35 },
    { type: 'hold', player: 'D2', start: 4.35, end: 4.6 },
    { type: 'pass', from: 'D2', to: 'D3', start: 4.6, end: 5.15 },
    { type: 'hold', player: 'D3', start: 5.15, end: 5.35 },
    { type: 'shot', player: 'D3', start: 5.35, end: 5.9, hoop: 'right' },
    { type: 'hold', player: 'D3', start: 6.3, end: 10.45 },
    { type: 'pass', from: 'D3', to: 'D1', start: 10.45, end: 10.95 },
    { type: 'hold', player: 'D1', start: 10.95, end: 11.2 },
    { type: 'shot', player: 'D1', start: 11.2, end: 11.8, hoop: 'left', make: false },
    { type: 'rebound', to: 'L4', start: 11.8, end: 12.2, hoop: 'left' },
    { type: 'hold', player: 'L4', start: 12.2, end: END_TAU },
  ],
  arrows: [
    { show: 3.6, hide: tAt(5.9), from: 0, to: 3.9, players: ['D1', 'D2', 'D3'] },
    { show: 6.0, hide: tAt(5.9), from: 2.45, to: 6.9, players: ['L3'] },
    { show: tAt(6.3), hide: tAt(10.4), from: 6.3, to: 10.4, players: ['D3', 'D1', 'D2'] },
    { show: tAt(12.2), hide: tAt(16.5), from: 12.2, to: 16.5, players: ['L4', 'L5', 'L6'] },
    { show: tAt(12.6), hide: tAt(16.5), from: 12.6, to: 16.3, players: ['D4', 'D5', 'D6'] },
  ],
  steps: [
    {
      at: 0,
      chapter: 'Setup',
      title: 'Two teams: Dark and Light',
      body: 'Each team lines up at its coaches box. Dark on the far sideline, Light on the near sideline.',
      callout: { player: 'D5', text: 'Dark line' },
    },
    {
      at: 3,
      title: 'Three attack two',
      body: 'Three Dark players attack. Two Light players wait in tandem: top at the free-throw line, bottom under the basket.',
      callout: { player: 'L1', text: 'Light tandem' },
    },
    {
      at: 5.6,
      title: 'The +1 waits at the coaches box',
      body: 'The front player in the Light line is the +1. They can\'t go until the ball crosses half court.',
      callout: { player: 'L3', text: 'Light +1 waits here' },
      tone: 'warning',
    },
    {
      at: RUN,
      chapter: 'Possession 1: Dark attack',
      title: 'Go!',
      body: 'Middle dribbles hard up the floor. Wings sprint wide and stay ahead of the ball.',
      callout: { player: 'D1', text: 'Push it' },
    },
    {
      at: tAt(2.45),
      tone: 'warning',
      title: 'Ball over half: the +1 goes',
      body: 'A foot in the centre circle, then sprint back on defence to make it 3-on-3.',
      callout: { player: 'L3', text: 'Foot in the circle, then sprint' },
      quiz: {
        prompt: 'The ball just crossed half court. Who has to move now?',
        answer: 'L3',
        choices: ['L1', 'L2', 'L3', 'L4'],
        explain: 'Light 3 is the +1. They get a foot in the centre circle, then sprint back to make it 3-on-3.',
      },
    },
    {
      at: tAt(FREEZE_TAU),
      freeze: true,
      title: 'Bottom takes the first pass',
      body: 'Top has stopped the ball, so bottom closes out to the wing and top drops to protect the rim.',
      callout: { player: 'L2', text: 'Bottom takes the first pass' },
      quiz: {
        prompt: 'The top defender has stopped the ball. Who takes the first pass to the wing?',
        answer: 'L2',
        choices: ['L1', 'L2', 'L3'],
        explain: 'The bottom defender (Light 2) closes out to the wing. Light 1 drops to the basket.',
      },
    },
    {
      at: tAt(FREEZE_TAU) + FREEZE_FOR,
      title: 'Swing it before they recover',
      body: 'Catch and pass in one motion. The weak side is open for a split second.',
      callout: { player: 'D3', text: 'Open on the weak side' },
    },
    {
      at: tAt(5.9),
      chapter: 'Possession 2: make it, take it',
      tone: 'success',
      title: 'Score! Dark go again',
      body: 'Dark scored, so the same three Dark players grab the ball and attack the other way.',
      callout: { player: 'D3', text: 'Grab it and go' },
    },
    {
      at: tAt(6.9),
      title: 'Fresh Light tandem',
      body: 'Two new Light players run out from the line to defend the other end. The three Light defenders go to the back of their line.',
      callout: { player: 'L4', text: 'Fresh tandem' },
    },
    {
      at: tAt(8.9),
      tone: 'warning',
      title: 'Ball over half: Light\'s next +1',
      body: 'The new front of the Light line touches the circle and gets back.',
      callout: { player: 'L6', text: 'Next +1' },
    },
    {
      at: tAt(11.2),
      title: 'Contested shot...',
      body: 'Dark took too long and the +1 is back. The shot is rushed.',
      callout: { player: 'D1', text: 'Rushed shot' },
      tone: 'warning',
    },
    {
      at: tAt(12.2),
      chapter: 'Possession 3: Light attack',
      title: 'Miss: Light rebound and go',
      body: 'A miss or a turnover means the defence attacks. Light\'s three go the other way.',
      callout: { player: 'L4', text: 'Rebound and go' },
    },
    {
      at: tAt(13.0),
      title: 'Fresh Dark tandem',
      body: 'Two new Dark players run out from the line. The three Dark attackers go to the back of their line.',
      callout: { player: 'D4', text: 'Fresh tandem' },
    },
    {
      at: tAt(15.15),
      tone: 'warning',
      title: 'Dark\'s +1 goes',
      body: 'Ball over half: foot in the centre circle, then sprint back.',
      callout: { player: 'D6', text: 'Foot in the circle' },
    },
    {
      at: tAt(END_TAU),
      chapter: 'The cycle',
      tone: 'success',
      title: 'And it keeps going',
      body: 'Score: the same three go again. Miss or turnover: the defence goes the other way. The +1 always waits for half court.',
    },
  ],
  marks: [
    { kind: 'link', a: 'L1', b: 'L2', text: 'Tandem', from: 3.2, to: RUN - 0.2 },
    { kind: 'tag', player: 'L3', text: '+1', from: 5.6, to: tAt(2.45), tone: 'warning' },
    { kind: 'tag', player: 'L2', text: 'Takes 1st pass', from: tAt(FREEZE_TAU) + 0.1, to: tAt(FREEZE_TAU) + FREEZE_FOR },
    { kind: 'tag', player: 'L1', text: 'Drops', from: tAt(FREEZE_TAU) + 0.4, to: tAt(FREEZE_TAU) + FREEZE_FOR },
    { kind: 'tag', player: 'L3', text: 'Too late', from: tAt(6.4), to: tAt(7.6), tone: 'warning' },
    { kind: 'link', a: 'L4', b: 'L5', text: 'Tandem', from: tAt(8.8), to: tAt(10.4) },
    { kind: 'tag', player: 'L6', text: '+1', from: tAt(7.4), to: tAt(8.9), tone: 'warning' },
    { kind: 'link', a: 'D4', b: 'D5', text: 'Tandem', from: tAt(15.2), to: tAt(END_TAU) },
    { kind: 'tag', player: 'D6', text: '+1', from: tAt(13.3), to: tAt(15.15), tone: 'warning' },
  ],
  meters: [
    {
      label: 'Advantage window',
      from: tAt(2.45),
      to: tAt(6.4),
      start: 2.45,
      end: 6.9,
      resolveAt: 5.9,
      outcome: 'success',
      outcomeText: 'Scored before the +1 got back',
    },
    {
      label: 'Advantage window',
      from: tAt(8.9),
      to: tAt(12.4),
      start: 8.9,
      end: 11.2,
      resolveAt: 11.2,
      outcome: 'fail',
      outcomeText: 'Too slow: the +1 made it back',
    },
    {
      label: 'Advantage window',
      from: tAt(15.15),
      to: LENGTH,
      start: 15.15,
      end: 18.6,
    },
  ],
  setup: [
    'Split into two teams, Dark and Light, with bibs.',
    'Each team lines up at its coaches box, on opposite sidelines.',
    'Three Dark players start on the baseline with the ball. Two Light players wait in tandem at the far end.',
    'The front player in the Light line is the +1.',
  ],
  howItRuns: [
    'Dark attack 3-on-2. When the ball crosses half court, the +1 gets a foot in the centre circle and sprints back on defence.',
    'If the offence scores, the same three keep the ball and attack the other way.',
    'If they miss (or turn it over), the three defenders go on offence the other way.',
    'At the other end, two fresh players from the defending team\'s line wait in tandem, and their +1 goes when the ball crosses half.',
    'Players coming off the court go to the back of their own line.',
  ],
  coachingPoints: [
    {
      title: 'Offence',
      points: [
        'Push the ball. You only have the advantage until the +1 gets back.',
        'Wings sprint wide and stay ahead of the ball.',
        'Middle attacks to the free-throw line and makes the top defender commit.',
        'Catch and pass in one motion. Two passes, then score.',
      ],
    },
    {
      title: 'Defence',
      points: [
        'Tandem: top stops the ball, bottom takes the first pass, top drops to the rim.',
        '+1: foot in the circle, then sprint to the paint before finding a player.',
        'Talk early: "Ball!" and "I\'ve got first pass!"',
        'Get the rebound and go. The next attack starts on the catch.',
      ],
    },
  ],
  mistakes: [
    'The +1 leaving before the ball crosses half, or skipping the centre circle.',
    'Wings running too close to the ball, so one defender can guard two attackers.',
    'Fresh tandem jogging out and arriving after the attack.',
    'Walking off after a make. Make it, take it means the same three go straight away.',
  ],
  progressions: [
    'Limit the middle player to two dribbles past half court.',
    'Add a shot clock: score within six seconds of crossing half.',
    'Play to a score: first team to 7 wins.',
    'Make the +1 touch the far side of the circle for an easier attack, or the near side for a harder one.',
  ],
};
